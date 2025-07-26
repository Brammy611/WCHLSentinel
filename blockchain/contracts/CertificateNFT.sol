// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract CertificateNFT is ERC721, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    struct Certificate {
        string examId;
        address student;
        uint256 score;
        uint256 timestamp;
        string metadataURI;
    }

    mapping(uint256 => Certificate) public certificates;

    event CertificateIssued(
        uint256 indexed tokenId,
        address indexed student,
        string examId,
        uint256 score
    );

    constructor() ERC721("ExamCertificate", "EXAM") {}

    function issueCertificate(
        address student,
        string memory examId,
        uint256 score,
        string memory metadataURI
    ) public onlyOwner returns (uint256) {
        _tokenIds.increment();
        uint256 newTokenId = _tokenIds.current();

        certificates[newTokenId] = Certificate(
            examId,
            student,
            score,
            block.timestamp,
            metadataURI
        );

        _mint(student, newTokenId);
        
        emit CertificateIssued(newTokenId, student, examId, score);
        
        return newTokenId;
    }

    function getCertificate(uint256 tokenId) 
        public 
        view 
        returns (Certificate memory) 
    {
        require(_exists(tokenId), "Certificate does not exist");
        return certificates[tokenId];
    }
}