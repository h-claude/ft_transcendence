// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ScoreStorage {

	address public immutable owner;
	mapping(bytes32 => uint256) public gameScore;



	event ScoreSaved(bytes32 indexed gameId, uint256[] userIds, uint32[] scores, uint256 packed, uint256 time);
	error NotOwner();
	error LengthMismatch();
	error TooManyPlayers();
	error InvalidTime();
	error AlreadyExists(bytes32 gameId);

	modifier onlyOwner(){
		if (msg.sender != owner) revert NotOwner();
		_;
	}

	constructor() {
		owner = msg.sender;
	}
	/*----------------------------------------------------------------------*/
	/*gameId = keccak cumulatif sur l odre d'IDS fournis + le time */

	function gameid(uint256[] memory userIds, uint256 time) public pure returns (bytes32) {
		bytes32 id;
		for (uint256 i = 0; i < userIds.length; i++){
			id = keccak256(abi.encodePacked(id, "|", userIds[i]));
		}
		id = keccak256(abi.encodePacked(id, "|t|", time));
		return id;
	}

	function scoresGameEncode(uint8 playerCount, uint32[] memory scores) public pure returns (uint256){
		require(scores.length == playerCount, "missmatch!");
		require(playerCount <= 7, "MAX 7 players!");
		uint256 result = playerCount;
		unchecked {	
			for (uint8 i = 0; i < playerCount; i++){
				result |= uint256(scores[i]) << (8 + i * 32);
			}
		}
		return result;
	}



	function scoresGameDecode(uint256 packed)public pure returns (uint8 playerCount, uint32[] memory scores){
		playerCount = uint8(packed & 0xFF);
		require(playerCount <= 7, "MAX 7 players");
		scores = new uint32[](playerCount);
		unchecked {
			for (uint8 i = 0; i < playerCount; i++){
				scores[i] = uint32((packed >> (8 + i * 32)) & 0xFFFFFFFF);
			}
		}
		return (playerCount, scores);
	}
/*
	function sort(address[] memory arr) internal pure returns (address[] memory) {
			for (uint i = 0; i < arr.length; i++) {
					for (uint j = i + 1; j < arr.length; j++) {
							if (arr[i] > arr[j]) {
									address temp = arr[i];
									arr[i] = arr[j];
									arr[j] = temp;
							}
					}
			}
			return arr;
	}
*/
	function setScore(uint256[] memory userIds, uint32[] memory scores, uint256 time) external onlyOwner() {
		uint256 n = userIds.length;
		if (n != scores.length) revert LengthMismatch();
		if (n == 0 || n > 7) revert TooManyPlayers();
		if (time == 0) revert InvalidTime();

		bytes32 id = gameid(userIds, time);
		if (gameScore[id] != 0) revert AlreadyExists(id);

		
		uint256 packed = scoresGameEncode(uint8(n), scores);
		gameScore[id] = packed;

		emit ScoreSaved(id, userIds, scores, packed, time);
	}
}
