"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.piecePoints = exports.pieceCodesArray = exports.pieceCodeClasses = exports.King = exports.Pawn = exports.Knight = exports.Bishop = exports.Rook = exports.Queen = exports.ChessPiece = void 0;
const board_1 = __importDefault(require("./board"));
const functions_1 = require("./functions");
const pieces_1 = __importDefault(require("../default/pieces"));
exports.ChessPiece = pieces_1.default;
let pieceCodesArray = ['k', 'q', 'r', 'b', 'n', 'p'];
exports.pieceCodesArray = pieceCodesArray;
const piecePoints = {
    p: 1,
    k: 69,
    q: 9,
    b: 3,
    n: 3,
    r: 5
};
exports.piecePoints = piecePoints;
class Queen extends pieces_1.default {
    constructor(team, pieceId) {
        super(team, 'q', pieceId);
    }
    getMoves(pos, board) {
        if (board.enPassant)
            return [];
        const vectors = [
            { "x": 0, "y": 1 },
            { "x": 1, "y": 1 },
            { "x": 1, "y": 0 },
            { "x": 1, "y": -1 },
            { "x": 0, "y": -1 },
            { "x": -1, "y": -1 },
            { "x": -1, "y": 0 },
            { "x": -1, "y": 1 },
        ];
        let moves = (0, functions_1.getRayCastVectors)(board, vectors, pos, this.team).vectors;
        return moves.filter(functions_1.legal, this);
    }
}
exports.Queen = Queen;
class Bishop extends pieces_1.default {
    constructor(team, pieceId) {
        super(team, 'b', pieceId);
    }
    getMoves(pos, board) {
        if (board.enPassant)
            return [];
        const vectors = [
            { "x": 1, "y": 1 },
            { "x": 1, "y": -1 },
            { "x": -1, "y": -1 },
            { "x": -1, "y": 1 },
        ];
        let moves = (0, functions_1.getRayCastVectors)(board, vectors, pos, this.team).vectors;
        return moves.filter(functions_1.legal, this);
    }
}
exports.Bishop = Bishop;
class Knight extends pieces_1.default {
    constructor(team, pieceId) {
        super(team, 'n', pieceId);
    }
    getMoves(pos, board) {
        if (board.enPassant)
            return [];
        const vectors = [
            { "x": 2, "y": 1 },
            { "x": 1, "y": 2 },
            { "x": 2, "y": -1 },
            { "x": 1, "y": -2 },
            { "x": -1, "y": -2 },
            { "x": -2, "y": -1 },
            { "x": -2, "y": 1 },
            { "x": -1, "y": 2 }
        ];
        let moves = (0, functions_1.getVectors)(board, vectors, pos, this.team).vectors;
        return moves.filter(functions_1.legal, this);
    }
}
exports.Knight = Knight;
class Rook extends pieces_1.default {
    constructor(team, pieceId) {
        super(team, 'r', pieceId);
    }
    getMoves(pos, board) {
        if (board.enPassant)
            return [];
        const vectors = [
            { "x": 0, "y": 1 },
            { "x": 1, "y": 0 },
            { "x": 0, "y": -1 },
            { "x": -1, "y": 0 },
        ];
        let moves = (0, functions_1.getRayCastVectors)(board, vectors, pos, this.team).vectors;
        const isAtBackRow = (pos.y === ((this.team === 'white') ? 7 : 0));
        if (isAtBackRow)
            for (let i = 0; i < moves.length; i++) {
                if (pos.x === 0)
                    moves[i].board.castleInfo[this.team].queenSide = false;
                if (pos.x === 7)
                    moves[i].board.castleInfo[this.team].kingSide = false;
            }
        return moves.filter(functions_1.legal, this);
    }
}
exports.Rook = Rook;
// Special Cases
class Pawn extends pieces_1.default {
    constructor(team, pieceId) {
        super(team, 'p', pieceId);
    }
    getMoves(pos, board) {
        const ownTeam = this.team;
        let hasMoved = (((ownTeam === 'white') ? 6 : 1) !== pos.y); // Piece is at the starting row of pawns for it's team
        let moves = [];
        // Take Right
        let yMoveVal = (ownTeam === "white") ? -1 : 1;
        let vectorToCheck = (0, functions_1.addVectorsAndCheckPos)(pos, { "x": 1, "y": yMoveVal });
        if (vectorToCheck) {
            if (board.enPassant && board.enPassant.x === vectorToCheck.x && board.enPassant.y === vectorToCheck.y && board.enPassant.y === ((ownTeam === 'white') ? 2 : 5)) {
                const newBoard = new board_1.default(board);
                newBoard.doMove(pos, vectorToCheck);
                newBoard.setPos({ "x": vectorToCheck.x, "y": pos.y }, null);
                moves.push({
                    "move": vectorToCheck,
                    "board": newBoard,
                    "moveType": ["enpassant", "capture", "p"]
                });
            }
            else {
                let takeRightPos = board.getPos(vectorToCheck);
                if (takeRightPos && takeRightPos.team !== ownTeam) {
                    const newBoard = new board_1.default(board);
                    newBoard.doMove(pos, vectorToCheck);
                    moves.push({
                        "move": vectorToCheck,
                        "board": newBoard,
                        "moveType": ["capture", takeRightPos.code]
                    });
                }
            }
        }
        // Take Left
        vectorToCheck = (0, functions_1.addVectorsAndCheckPos)(pos, { "x": -1, "y": yMoveVal });
        if (vectorToCheck) {
            if (board.enPassant && board.enPassant.x === vectorToCheck.x && board.enPassant.y === vectorToCheck.y && board.enPassant.y === ((ownTeam === 'white') ? 2 : 5)) {
                const newBoard = new board_1.default(board);
                newBoard.doMove(pos, vectorToCheck);
                newBoard.setPos({ "x": vectorToCheck.x, "y": pos.y }, null);
                moves.push({
                    "move": vectorToCheck,
                    "board": newBoard,
                    "moveType": ["enpassant", "capture", "p"]
                });
            }
            else {
                let takeLeftPos = board.getPos(vectorToCheck);
                if (takeLeftPos && takeLeftPos.team !== ownTeam) {
                    const newBoard = new board_1.default(board);
                    newBoard.doMove(pos, vectorToCheck);
                    moves.push({
                        "move": vectorToCheck,
                        "board": newBoard,
                        "moveType": ["capture", takeLeftPos.code]
                    });
                }
            }
        }
        // Single Move
        vectorToCheck = (0, functions_1.addVectorsAndCheckPos)(pos, { "x": 0, "y": yMoveVal });
        if (vectorToCheck && !board.getPos(vectorToCheck)) {
            const newBoard = new board_1.default(board);
            newBoard.doMove(pos, vectorToCheck);
            moves.push({
                "move": vectorToCheck,
                "board": newBoard,
                "moveType": []
            });
            // Double Move
            if (!hasMoved) {
                vectorToCheck = (0, functions_1.addVectorsAndCheckPos)(pos, { "x": 0, "y": 2 * yMoveVal });
                if (vectorToCheck && !board.getPos(vectorToCheck)) {
                    const newBoard = new board_1.default(board);
                    newBoard.doMove(pos, vectorToCheck);
                    let minusPos = newBoard.getPos((0, functions_1.addVectorsAndCheckPos)(pos, { "x": -1, "y": 2 * yMoveVal }));
                    let plusPos = newBoard.getPos((0, functions_1.addVectorsAndCheckPos)(pos, { "x": 1, "y": 2 * yMoveVal }));
                    if ((minusPos && minusPos.team !== ownTeam && minusPos.code === 'p') || (plusPos && plusPos.team !== ownTeam && plusPos.code === 'p'))
                        newBoard.enPassant = (0, functions_1.addVectorsAndCheckPos)(pos, { "x": 0, "y": yMoveVal });
                    moves.push({
                        "move": vectorToCheck,
                        "board": newBoard,
                        "moveType": []
                    });
                }
            }
        }
        if (board.enPassant) {
            for (let i = 0; i < moves.length; i++) {
                if (moves[i].moveType.includes("enpassant")) {
                    return [moves[i]].filter(functions_1.legal, this);
                }
            }
            return [];
        }
        if (((this.team === "white") ? 1 : 6) === pos.y)
            return moves.filter(functions_1.legal, this).map((item, index) => {
                item.moveType.push('promote');
                return item;
            });
        else
            return moves.filter(functions_1.legal, this);
    }
}
exports.Pawn = Pawn;
class King extends pieces_1.default {
    constructor(team, pieceId) {
        super(team, 'k', pieceId);
    }
    getMoves(pos, board) {
        if (board.enPassant)
            return [];
        const vectors = [
            { "x": 0, "y": 1 },
            { "x": 1, "y": 1 },
            { "x": 1, "y": 0 },
            { "x": 1, "y": -1 },
            { "x": 0, "y": -1 },
            { "x": -1, "y": -1 },
            { "x": -1, "y": 0 },
            { "x": -1, "y": 1 },
        ];
        let moves = (0, functions_1.getVectors)(board, vectors, pos, this.team).vectors;
        if (board.castleInfo[this.team].kingSide && pos.x === 4 && (pos.y === 0 || pos.y === 7))
            for (let i = 0; i < moves.length; i++)
                moves[i].board.castleInfo[this.team].kingSide = false;
        if (board.castleInfo[this.team].queenSide && pos.x === 3 && (pos.y === 0 || pos.y === 7))
            for (let i = 0; i < moves.length; i++)
                moves[i].board.castleInfo[this.team].queenSide = false;
        if (!board.inCheck(this.team).length) {
            if (board.castleInfo[this.team].kingSide && pos.x === 4 && (pos.y === 0 || pos.y === 7)) {
                let piecesInWay = [];
                for (let i = 4; i < 8; i++) {
                    const piece = board.getPos({ "x": i, "y": pos.y });
                    if (piece && piece.team === this.team)
                        piecesInWay.push(piece.code);
                }
                if (piecesInWay.length === 2 && piecesInWay.includes('k') && piecesInWay.includes('r')) {
                    const newBoard = new board_1.default(board);
                    const vectorToDisplay = { "x": 6, "y": pos.y };
                    if (vectorToDisplay && !board.getPos({ "x": 5, "y": pos.y }) && !board.getPos({ "x": 6, "y": pos.y })) {
                        newBoard.doMove(pos, { "x": 5, "y": pos.y });
                        if (!newBoard.inCheck(this.team).length) {
                            newBoard.doMove({ "x": 5, "y": pos.y }, vectorToDisplay);
                            if (!newBoard.inCheck(this.team).length) {
                                newBoard.doMove({ "x": 7, "y": pos.y }, { "x": 5, "y": pos.y });
                                newBoard.castleInfo[this.team].kingSide = false;
                                moves.push({
                                    move: vectorToDisplay,
                                    board: newBoard,
                                    moveType: ["castleKingSide"]
                                });
                                const castleCaptureBoard = new board_1.default(newBoard);
                                moves.push({
                                    move: { "x": 7, "y": pos.y },
                                    board: castleCaptureBoard,
                                    moveType: ["castleKingSide", 'captureRookCastle'],
                                    displayVector: vectorToDisplay
                                });
                            }
                        }
                    }
                }
            }
            if (board.castleInfo[this.team].queenSide && pos.x === 3 && (pos.y === 0 || pos.y === 7)) {
                let piecesInWay = [];
                for (let i = 3; i >= 0; i--) {
                    const piece = board.getPos({ "x": i, "y": pos.y });
                    if (piece && piece.team === this.team)
                        piecesInWay.push(piece.code);
                }
                if (piecesInWay.length === 2 && piecesInWay.includes('k') && piecesInWay.includes('r')) {
                    const newBoard = new board_1.default(board);
                    const vectorToDisplay = { "x": 1, "y": pos.y };
                    if (vectorToDisplay && !board.getPos({ "x": 2, "y": pos.y }) && !board.getPos({ "x": 1, "y": pos.y })) {
                        newBoard.doMove(pos, { "x": 2, "y": pos.y });
                        if (!newBoard.inCheck(this.team).length) {
                            newBoard.doMove({ "x": 2, "y": pos.y }, vectorToDisplay);
                            if (!newBoard.inCheck(this.team).length) {
                                newBoard.doMove({ "x": 0, "y": pos.y }, { "x": 2, "y": pos.y });
                                newBoard.castleInfo[this.team].queenSide = false;
                                moves.push({
                                    move: vectorToDisplay,
                                    board: newBoard,
                                    moveType: ["castleQueenSide"]
                                });
                                const castleCaptureBoard = new board_1.default(newBoard);
                                moves.push({
                                    move: { "x": 0, "y": pos.y },
                                    board: castleCaptureBoard,
                                    moveType: ["castleQueenSide", 'captureRookCastle'],
                                    displayVector: vectorToDisplay
                                });
                            }
                        }
                    }
                }
            }
        }
        return moves.filter(functions_1.legal, this);
    }
}
exports.King = King;
const pieceCodeClasses = {
    "q": Queen,
    "k": King,
    "b": Bishop,
    "n": Knight,
    "r": Rook,
    "p": Pawn
};
exports.pieceCodeClasses = pieceCodeClasses;
//# sourceMappingURL=pieces.js.map