"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.normaliseDirection = normaliseDirection;
exports.getRayCastVectors = getRayCastVectors;
exports.getVectors = getVectors;
exports.legal = legal;
exports.addVectorsAndCheckPos = addVectorsAndCheckPos;
exports.convertToChessNotation = convertToChessNotation;
exports.convertToPosition = convertToPosition;
exports.VecSame = VecSame;
exports.cancelOutCapturedMaterial = cancelOutCapturedMaterial;
const board_1 = __importDefault(require("./board"));
const pieces_1 = require("./pieces");
function getRayCastVectors(board, vectors, position, team) {
    let validVectors = [];
    let collidedPieces = [];
    for (let i = 0; i < vectors.length; i++) {
        let vector = vectors[i];
        let currentCoords = {
            "x": vector.x + position.x,
            "y": vector.y + position.y
        };
        let vectorValid = true;
        while (vectorValid && currentCoords.x >= 0 && currentCoords.y >= 0 && currentCoords.x < 8 && currentCoords.y < 8) {
            let currentPiece = board.getPos(currentCoords);
            if (currentPiece === null) {
                const newBoard = new board_1.default(board);
                newBoard.doMove(position, currentCoords);
                validVectors.push({
                    "move": Object.assign({}, currentCoords),
                    "board": newBoard,
                    "moveType": []
                });
            }
            else if (currentPiece.team === team) {
                vectorValid = false;
            }
            else {
                collidedPieces.push(currentPiece);
                const newBoard = new board_1.default(board);
                newBoard.doMove(position, currentCoords);
                validVectors.push({
                    "move": Object.assign({}, currentCoords),
                    "board": newBoard,
                    "moveType": ["capture", currentPiece.code]
                });
                vectorValid = false;
            }
            currentCoords.x += vector.x;
            currentCoords.y += vector.y;
        }
    }
    return {
        "pieces": collidedPieces,
        "vectors": validVectors
    };
}
function normaliseDirection(startValue, endValue) {
    return Math.sign(endValue - startValue);
}
function getVectors(board, vectors, position, team) {
    let validVectors = [];
    let collidedPieces = [];
    for (let i = 0; i < vectors.length; i++) {
        let vector = vectors[i];
        let currentCoords = {
            "x": vector.x + position.x,
            "y": vector.y + position.y
        };
        if (currentCoords.x >= 0 && currentCoords.y >= 0 && currentCoords.x < 8 && currentCoords.y < 8) {
            let currentPiece = board.getPos(currentCoords);
            if (currentPiece === null) {
                const newBoard = new board_1.default(board);
                newBoard.doMove(position, currentCoords);
                validVectors.push({
                    "move": Object.assign({}, currentCoords),
                    "board": newBoard,
                    "moveType": []
                });
            }
            else if (currentPiece.team !== team) {
                collidedPieces.push(currentPiece);
                const newBoard = new board_1.default(board);
                newBoard.doMove(position, currentCoords);
                validVectors.push({
                    "move": Object.assign({}, currentCoords),
                    "board": newBoard,
                    "moveType": ["capture", currentPiece.code]
                });
            }
        }
    }
    return {
        "pieces": collidedPieces,
        "vectors": validVectors
    };
}
function legal(value) {
    if (this instanceof pieces_1.Pawn || value.moveType.includes('capture'))
        value.board.halfMovesSinceCaptureOrPawnMove = 0;
    else
        value.board.halfMovesSinceCaptureOrPawnMove++;
    if (value.moveType.includes('capture')) {
        for (let i = 0; i < value.moveType.length; i++)
            if (pieces_1.pieceCodesArray.includes(value.moveType[i]))
                value.board.capturedPieces[value.board.getTurn('next')].push(value.moveType[i]);
    }
    value.board.halfMoveNumber++;
    return !value.board.inCheck(this.team).length;
}
function addVectorsAndCheckPos(vector1, vector2) {
    let returnVector = {
        "x": vector1.x + vector2.x,
        "y": vector1.y + vector2.y
    };
    if (returnVector.x >= 0 && returnVector.x < 8 && returnVector.y >= 0 && returnVector.y < 8)
        return returnVector;
    else
        return null;
}
function convertToChessNotation(position, coord) {
    if (coord) {
        if (coord === 'x') {
            return String.fromCharCode(97 + position);
        }
        else {
            return (8 - position).toString();
        }
    }
    else {
        position = position;
        return String.fromCharCode(97 + position.x) + (8 - position.y);
    }
}
function convertToPosition(notation, coord) {
    if (!coord)
        return { "x": parseInt(notation[0], 36) - 10, "y": 8 - Number(notation[1]) };
    else if (coord === 'x')
        return parseInt(notation, 36) - 10;
    else
        return 8 - Number(notation);
}
function VecSame(v1, v2) {
    return (v1.x === v2.x && v1.y === v2.y);
}
function arrayToCountObj(array) {
    let counts = {};
    for (let i = 0; i < array.length; i++) {
        const item = array[i];
        if (counts[item])
            counts[item]++;
        else
            counts[item] = 1;
    }
    return counts;
}
function cancelOutCapturedMaterial(p1, p2) {
    let materialP1 = arrayToCountObj(p1);
    let materialP2 = arrayToCountObj(p2);
    let checkedPieces = [];
    for (let item in materialP1) {
        if (materialP2[item]) {
            let minSame = Math.min(materialP1[item], materialP2[item]);
            materialP1[item] -= minSame;
            materialP2[item] -= minSame;
        }
        checkedPieces.push(item);
    }
    materialP1.points = 0;
    materialP2.points = 0;
    for (let item in materialP1)
        if (item !== 'points')
            materialP1.points += materialP1[item] * pieces_1.piecePoints[item];
    for (let item in materialP2)
        if (item !== 'points')
            materialP2.points += materialP2[item] * pieces_1.piecePoints[item];
    let minPoints = Math.min(materialP1.points, materialP2.points);
    materialP1.points -= minPoints;
    materialP2.points -= minPoints;
    return {
        white: materialP1,
        black: materialP2
    };
}
//# sourceMappingURL=functions.js.map