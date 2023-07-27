// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AutomationCompatibleInterface.sol";
import "hardhat/console.sol";

/* Custom error codes */
error Roulette__NotEnoughEntranceFee();
error Roulette__ElementDoesntExist();
error Roulette__MinBetNotPlaced();
error Roulette__GameClosed();
error Roulette__MinOutsideBetNotPlaced();
error Roulette__InvalidInsideBet();
error Roulette__NotValidPlayer();
error Roulette__NotEnoughBalance();
error Roulette__IssueWithTransfer();
error Roulette__UpkeepNotNeeded(uint256 currentBalance, uint256 bets, uint256 betState);
error Roulette__NotAllowedToPlaceBets();
error Roulette__PayOutError();

/**
 * @title Casino Roulette Contract
 * @author Mumtaz503
 * @notice This contract is for creating an untamperable, decentralized and a verifiably fair game of Roulette
 * @dev This contract implements Chainlink's VRF V2 and Automation Compatible Interface
 */

contract Roulette is VRFConsumerBaseV2, Ownable, AutomationCompatibleInterface {
    /* Type Declarations */
    enum GameState {
        OPEN, //0
        CLOSE //1
    }

    enum BetState {
        OPEN, //0
        CALCULATING, //1
        CLOSE
    }

    struct Bet {
        address payable player;
        string[] betElements;
        uint256 betAmount;
        bool isInsideBet;
    }

    /* VRF Coordinator V2 state variables */
    VRFCoordinatorV2Interface private immutable i_vrfCoordinatorV2;
    uint64 private immutable i_subscriptionId;
    uint32 private immutable i_callbackGasLimit;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 constant NUM_WORDS = 1;
    bytes32 immutable i_gasLane;
    uint256[] private s_randomWords;
    //uint256 public s_requestId;
    address private s_player;

    /* Game state variables */
    string[] private s_table = [
            "00", "0", "1R", "2B", "3R", "4B", "5R", "6B", "7R", "8B", "9R", "10B", "11B", "12R",
            "13B", "14R", "15B", "16R", "17B", "18R", "19R", "20B", "21R", "22B", "23R", "24B",
            "25R", "26B", "27R", "28B", "29B", "30R", "31B", "32R", "33B", "34R", "35B", "36R"
        ];

    uint256 private immutable i_entranceFee;//entrance fee in wei.
    uint256 public immutable i_minInsideBet;
    uint256 public immutable i_minOutsideBet;
    GameState private s_gameState = GameState.CLOSE;
    BetState private s_betState = BetState.CLOSE;
    uint256 private s_lastTimestamp;
    uint256  immutable i_keepersInterval;
    Bet[] private s_bets;
    Bet[] private s_wonBets;
    address[] private s_players;

    /* Events */
    event GameEntered(address indexed player);
    event BetPlaced(Bet indexed bet, address indexed player);
    event RequestedRandomElement(uint256 indexed requestId);
    event ElementSelected(string indexed);
    event BetWon(Bet indexed);
    event BetLost(Bet[] indexed, string indexed);
    event AmountTransfered(address indexed player, uint256 indexed amount);

    /* Mappings */
    mapping(address => uint256) private s_playerBalance;
    mapping(address => Bet[]) private s_playerToWonBets;

    /* Functions */
    constructor(
        uint64 subscriptionId,
        address vrfCoordinator,
        bytes32 gasLane,
        uint32 callbackGassLimit,
        uint256 keepersInterval,
        uint256 entranceFee,
        uint256 minOutsideBet,
        uint256 minInsideBet
        
    ) VRFConsumerBaseV2(vrfCoordinator) {
        i_vrfCoordinatorV2 = VRFCoordinatorV2Interface(vrfCoordinator);
        i_subscriptionId = subscriptionId;
        i_gasLane = gasLane;
        i_callbackGasLimit = callbackGassLimit;
        i_keepersInterval = keepersInterval;
        i_entranceFee = entranceFee;
        i_minOutsideBet = minOutsideBet;
        i_minInsideBet = minInsideBet;
    }

    /**
     * @dev Allows Players to enter the game by paying a little fee
     * 1) Checks if the sent amount is less than the entrance fee
     * 2) Reverts with a custom error code if that's the case
     * 3) Sets the game state to be open
     * 4) Emits an event with the address of the player
     * 5) Initializes the mapping with the address of the player
     * 6) Sets the bet state to be open
     */
    function enterRoulette() public payable {
        
        if(msg.value < i_entranceFee) {
            revert Roulette__NotEnoughEntranceFee();
        }

        if(s_gameState == GameState.CLOSE){
            s_gameState = GameState.OPEN;
        }

        emit GameEntered(msg.sender);
        s_players.push(msg.sender);
        s_playerBalance[msg.sender] = 0;
        s_betState = BetState.OPEN;
        s_player = msg.sender;
    }

    /**
     * @dev Allows players to place bets on the table.
     * 1) Declare a memory variable of string[] to save gas
     * 2) Check to see if the game state is open
     * 3) Check to determine if it is an inside bet or not
     * 4) Check to see if the minimum bet is placed for either inside or outside bets
     * 5) Checks if the element(s) are present in the table array
     * 6) Checks if the sent values are appropriately sent for inside or outside bets then places the bet
     */
    function placeBet(Bet memory _bet) public payable{

        string[] memory table = s_table;

        if(msg.sender != s_player) {
            revert Roulette__NotValidPlayer();
        }

        if(s_gameState != GameState.OPEN) {
            revert Roulette__GameClosed();
        }

        if(s_betState != BetState.OPEN) {
            revert Roulette__NotAllowedToPlaceBets();
        }

        if(_bet.betElements.length > 6 && _bet.isInsideBet){
            revert Roulette__InvalidInsideBet();
        }

        if(_bet.isInsideBet && _bet.betAmount < i_minInsideBet ){
            revert Roulette__MinBetNotPlaced();
        } else if (!_bet.isInsideBet && _bet.betAmount < i_minOutsideBet) {
            revert Roulette__MinOutsideBetNotPlaced();
        }

        if (s_bets.length == 0) {
            s_lastTimestamp = block.timestamp;
        }

        for(uint256 i = 0; i< _bet.betElements.length; i++){
            bool elementExists = false;
            for(uint256 j = 0; j< table.length; j++){
                if(keccak256(bytes(normalizeString(_bet.betElements[i]))) == 
                keccak256(bytes(normalizeString(table[j])))){
                    elementExists = true;
                    break;
                }
            }
            if(!elementExists){
                revert Roulette__ElementDoesntExist();
            }
        }

        if(msg.value == _bet.betAmount && 
            msg.value >= (_bet.isInsideBet ? i_minInsideBet : i_minOutsideBet)) {
                s_bets.push(_bet);
                emit BetPlaced(_bet, msg.sender);
        }

    }

    /**
     * @dev Checks for the conditions to be true for triggering the performUpkeep() function
     * 1) Checks if the BetState is OPEN or not
     * 2) Checks if the specified time period has passed or not
     * 3) Checks if the user has placed any bets or not
     * 4) Checks if the contract has some Balance
     * 5) Once all the conditions are met the function returns true
     */
    function checkUpkeep(
        bytes memory /* checkData */
        ) 
        public 
        override 
        returns (
            bool upkeepNeeded, 
            bytes memory /* performData */
            ) {

        bool isOpen = (BetState.OPEN == s_betState);
        bool hasTimePassed = ((block.timestamp - s_lastTimestamp) > i_keepersInterval);
        bool hasBets = (s_bets.length > 0);
        bool hasBalance = (address(this).balance > 0);

        upkeepNeeded = (isOpen && hasTimePassed && hasBets && hasBalance);
        //console.log(isOpen, hasTimePassed, hasBets, hasBalance);
        return (upkeepNeeded, "0x0");
    }

    /**
     * @dev The function triggers making requests to Chainlink's VRF Coordinator to return requested random words
     * 1) Can only be called if the checkUpkeep() returns true
     */
    function performUpkeep(bytes calldata /* performData */ ) external override {

        (bool upkeepNeeded, ) = checkUpkeep("");

        if(!upkeepNeeded) {
            revert Roulette__UpkeepNotNeeded(
                address(this).balance, s_bets.length, uint256(s_betState)
            );
        }
        s_betState = BetState.CALCULATING;
        uint256 requestId = i_vrfCoordinatorV2.requestRandomWords(
            i_gasLane,
            i_subscriptionId,
            REQUEST_CONFIRMATIONS,
            i_callbackGasLimit,
            NUM_WORDS
        );
        emit RequestedRandomElement(requestId);
    }
    /**
     * Fulfills the random numbers provided by the VRF coordinator. Selects a random element from the table and
     * handles winning or loosing of bets.
     */
    function fulfillRandomWords(
        uint256 /*_requestId*/,
        uint256[] memory randomWords
    ) internal override {

        string[] memory table = s_table;
        Bet[] memory bets = s_bets;

        uint256 randomElementIndex = randomWords[0] % 38;
        string memory randomElementSelected = table[randomElementIndex];
        emit ElementSelected(randomElementSelected);
        console.log(randomElementSelected);

        for(uint256 i = 0; i < bets.length; i++){
            bool isWinningBet = false;
            for (uint256 j = 0; j < bets[i].betElements.length; j++){
                if(keccak256(bytes(normalizeString(bets[i].betElements[j]))) == 
                    keccak256(bytes(normalizeString(randomElementSelected)))) {
                        isWinningBet = true;
                        s_wonBets.push(bets[i]);
                        emit BetWon(bets[i]);
                }
            }

            if(!isWinningBet) {
                emit BetLost(bets, randomElementSelected);
            }
        }

        delete s_bets;
        s_betState = BetState.OPEN;
        s_lastTimestamp = block.timestamp;

    }

    /**
     * 
     */

    function handlePayout() public {
        Bet[] memory wonBets = s_wonBets;
        uint256 payoutAmount = calculatePayout(wonBets);
        address payable player = wonBets[0].player;
        if(wonBets.length > 0) {
            player.transfer(payoutAmount);
            s_playerBalance[player] += payoutAmount;
            delete s_wonBets;
        } else {
            revert Roulette__PayOutError();
        }
    }

    function withdrawFunds() public onlyOwner{
        if (address(this).balance == 0) {
            revert Roulette__NotEnoughBalance();
        }

        (bool success, ) = owner().call{value: address(this).balance}("");

        if(!success) {
            revert Roulette__IssueWithTransfer();
        }
    }

    /* View and Pure Functions for testing and help */
    function calculatePayout(Bet[] memory wonBets) public pure returns (uint256){

        uint256 payAmount = 0;
        for (uint256 i = 0; i< wonBets.length; i++) {
            if (wonBets[i].isInsideBet) {
                if(wonBets[i].betElements.length == 1) {
                    payAmount += wonBets[i].betAmount * 35;
                } else if (wonBets[i].betElements.length == 2) {
                        payAmount += wonBets[i].betAmount * 17;
                } else if (wonBets[i].isInsideBet == true && wonBets[i].betElements.length == 3) {
                        payAmount += wonBets[i].betAmount * 11;
                } else if (wonBets[i].isInsideBet == true && wonBets[i].betElements.length == 4) {
                        payAmount += wonBets[i].betAmount * 8;
                } else if (wonBets[i].isInsideBet == true && wonBets[i].betElements.length == 5) {
                        payAmount += wonBets[i].betAmount * 6;
                } else if (wonBets[i].isInsideBet == true && wonBets[i].betElements.length == 6) {
                        payAmount += wonBets[i].betAmount * 5;
                }
            }
                
            if (!wonBets[i].isInsideBet) {
                if(wonBets[i].betElements.length == 12) {
                    payAmount += wonBets[i].betAmount * 2;
                } else if (wonBets[i].betElements.length == 18) {
                        payAmount += wonBets[i].betAmount;
                }
            }
        }
        return payAmount;
    }

    function normalizeString(string memory _element) internal pure returns(string memory){
        return string(abi.encodePacked(_element));
    }

    function getBets() public view returns(Bet[] memory) {
        return s_bets;
    }

    function getWonBets() public view returns(Bet[] memory) {
        return s_wonBets;
    }

    function getGameState() public view returns(GameState) {
        return s_gameState;
    }

    function getPlayerBalance(address _player) public view returns(uint256){
        return s_playerBalance[_player];
    }

    function getBetState() public view returns (BetState) {
        return s_betState;
    }

    function getLastTimeStamp() public view returns (uint256) {
        return s_lastTimestamp;
    }

    function getInterval() public view returns (uint256) {
        return i_keepersInterval;
    }

    function getEntranceFee() public view returns (uint256) {
        return i_entranceFee;
    }

}
