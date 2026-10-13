// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/// @title Squad Cards
/// @notice Players build 6-player squads and mint non-transferable cards.
/// When a round ends, the squad with the most cards wins. Its holders get their
/// money back plus a share of the money paid into the other squads.
/// The owner CANNOT withdraw player funds: money only leaves via claim() or the 5% fee on profit.
contract SquadCards is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Squad {
        string name;
        address creator;
        uint64 round;
        uint32 mints;
        uint8[6] players; // [fwd, mid1, mid2, def1, def2, gk]  ids: GK 0-9, DEF 10-19, MID 20-29, FWD 30-39
        uint256 paid;
        uint256 creatorFid;
    }

    struct Result {
        uint256 squadId;
        uint256 winnerPaid;
        uint256 holdersPool;
        uint256 bonus;
        bool finalized;
    }

    IERC20 public immutable usdc;
    uint256 public roundDuration;
    uint256 public constant BASE = 100_000; // $0.10
    uint256 public constant STEP = 50_000; // +$0.05 per card

    address public signer;
    address public treasury;
    uint256 public maxRoundTotal; // safety cap on money per round

    uint256 public squadCount;
    uint256 public currentRound = 1;
    uint256 public roundEnd;

    mapping(uint256 => Squad) private _squads;
    mapping(uint256 => uint256[]) private _roundSquads;
    mapping(uint256 => uint256) public roundTotal;
    mapping(uint256 => uint256) public leader; // round => squadId with most cards (first to reach wins ties)
    mapping(uint256 => mapping(bytes32 => bool)) public usedKey; // round => squad hash
    mapping(uint256 => mapping(uint256 => bool)) public fidCreated; // round => fid
    mapping(uint256 => mapping(uint256 => bool)) public hasCard; // squadId => fid
    mapping(uint256 => mapping(address => uint256)) public paidBy; // squadId => wallet => USDC paid
    mapping(uint256 => Result) public results;
    mapping(uint256 => mapping(address => bool)) public claimed;

    event SquadCreated(uint256 indexed round, uint256 indexed squadId, address creator, uint256 fid);
    event CardMinted(uint256 indexed squadId, address indexed buyer, uint256 fid, uint256 price);
    event RoundFinalized(uint256 indexed round, uint256 winnerSquadId);
    event Claimed(uint256 indexed round, address indexed user, uint256 amount);

    constructor(address _usdc, address _signer, address _treasury, uint256 _roundDuration, uint256 _maxRoundTotal)
        Ownable(msg.sender)
    {
        usdc = IERC20(_usdc);
        signer = _signer;
        treasury = _treasury;
        roundDuration = _roundDuration;
        maxRoundTotal = _maxRoundTotal;
        roundEnd = block.timestamp + _roundDuration;
    }

    // ---------- views ----------
    function getSquad(uint256 id) external view returns (Squad memory) {
        return _squads[id];
    }

    function getRoundSquads(uint256 round) external view returns (uint256[] memory) {
        return _roundSquads[round];
    }

    function cardPrice(uint256 id) public view returns (uint256) {
        return BASE + STEP * _squads[id].mints;
    }

    function pendingClaim(uint256 round, address user) public view returns (uint256 amt) {
        Result memory r = results[round];
        if (!r.finalized || r.squadId == 0 || claimed[round][user]) return 0;
        uint256 mine = paidBy[r.squadId][user];
        if (mine > 0) amt += mine + (r.holdersPool * mine) / r.winnerPaid;
        if (_squads[r.squadId].creator == user) amt += r.bonus;
    }

    // ---------- play ----------
    function createSquad(string calldata name, uint8[6] calldata p, uint256 fid, uint256 deadline, bytes calldata sig)
        external
        nonReentrant
    {
        require(block.timestamp < roundEnd, "round ended");
        _checkSig(fid, deadline, sig);
        _validate(name, p);
        uint256 id = _register(name, p, fid);
        _buy(id, fid, BASE);
    }

    function _validate(string calldata name, uint8[6] calldata p) internal pure {
        uint256 nameLen = bytes(name).length;
        require(nameLen > 0 && nameLen <= 24, "bad name");
        require(p[0] >= 30 && p[0] < 40, "bad fwd");
        require(p[1] >= 20 && p[1] < p[2] && p[2] < 30, "bad mids");
        require(p[3] >= 10 && p[3] < p[4] && p[4] < 20, "bad defs");
        require(p[5] < 10, "bad gk");
    }

    function _register(string calldata name, uint8[6] calldata p, uint256 fid) internal returns (uint256 id) {
        uint256 r = currentRound;
        bytes32 key = keccak256(abi.encodePacked(p));
        require(!usedKey[r][key], "squad exists");
        require(!fidCreated[r][fid], "one squad per fid");
        usedKey[r][key] = true;
        fidCreated[r][fid] = true;

        id = ++squadCount;
        Squad storage s = _squads[id];
        s.name = name;
        s.creator = msg.sender;
        s.round = uint64(r);
        s.players = p;
        s.creatorFid = fid;
        _roundSquads[r].push(id);
        emit SquadCreated(r, id, msg.sender, fid);
    }

    function mint(uint256 id, uint256 fid, uint256 deadline, bytes calldata sig) external nonReentrant {
        require(block.timestamp < roundEnd, "round ended");
        Squad storage s = _squads[id];
        require(s.creator != address(0) && s.round == currentRound, "bad squad");
        _checkSig(fid, deadline, sig);
        require(!hasCard[id][fid], "already minted");
        _buy(id, fid, BASE + STEP * s.mints);
    }

    function finalizeRound() external nonReentrant {
        require(block.timestamp >= roundEnd, "not ended");
        uint256 r = currentRound;
        uint256 id = leader[r];
        if (id != 0) {
            uint256 won = _squads[id].paid;
            uint256 profit = roundTotal[r] - won;
            uint256 holders = (profit * 75) / 100;
            uint256 bonus = (profit * 20) / 100;
            uint256 fee = profit - holders - bonus;
            results[r] = Result(id, won, holders, bonus, true);
            if (fee > 0) usdc.safeTransfer(treasury, fee);
        } else {
            results[r].finalized = true;
        }
        currentRound = r + 1;
        roundEnd = block.timestamp + roundDuration;
        emit RoundFinalized(r, id);
    }

    function claim(uint256 round) external nonReentrant {
        uint256 amt = pendingClaim(round, msg.sender);
        require(amt > 0, "nothing to claim");
        claimed[round][msg.sender] = true;
        usdc.safeTransfer(msg.sender, amt);
        emit Claimed(round, msg.sender, amt);
    }

    // ---------- internal ----------
    function _buy(uint256 id, uint256 fid, uint256 price) internal {
        Squad storage s = _squads[id];
        require(roundTotal[s.round] + price <= maxRoundTotal, "round cap reached");
        hasCard[id][fid] = true;
        s.mints += 1;
        s.paid += price;
        paidBy[id][msg.sender] += price;
        roundTotal[s.round] += price;
        uint256 l = leader[s.round];
        if (l == 0 || s.mints > _squads[l].mints) leader[s.round] = id;
        usdc.safeTransferFrom(msg.sender, address(this), price);
        emit CardMinted(id, msg.sender, fid, price);
    }

    function _checkSig(uint256 fid, uint256 deadline, bytes calldata sig) internal view {
        require(block.timestamp <= deadline, "signature expired");
        bytes32 h = keccak256(abi.encodePacked(block.chainid, address(this), msg.sender, fid, deadline));
        require(ECDSA.recover(MessageHashUtils.toEthSignedMessageHash(h), sig) == signer, "bad signature");
    }

    // ---------- owner (cannot touch player funds) ----------
    function setSigner(address a) external onlyOwner { signer = a; }
    function setTreasury(address a) external onlyOwner { treasury = a; }
    function setMaxRoundTotal(uint256 v) external onlyOwner { maxRoundTotal = v; }

    /// @notice Applies from the next round on. Allowed range: 10 minutes to 7 days.
    function setRoundDuration(uint256 secs) external onlyOwner {
        require(secs >= 600 && secs <= 7 days, "out of range");
        roundDuration = secs;
    }
}
