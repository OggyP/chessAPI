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
        if ((pos.y === 0 && this.team === 'black') || (pos.y === 7 && this.team === 'white')) {
            if (board.castleInfo[this.team].includes(pos.x)) {
                for (let i = 0; i < moves.length; i++) {
                    moves[i].board.castleInfo[this.team] = moves[i].board.castleInfo[this.team].filter((value) => {
                        return value !== pos.x;
                    });
                }
            }
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
        for (let i = 0; i < moves.length; i++)
            moves[i].board.castleInfo[this.team] = [];
        if (!board.inCheck(this.team).length && (pos.y === 0 || pos.y === 7)) {
            for (let rookXpos of board.castleInfo[this.team]) {
                // Find the rook's position
                let rookPos = {
                    x: rookXpos,
                    y: pos.y
                };
                const rook = board.getPos(rookPos);
                if (!rook || rook.code !== 'r' || rook.team !== this.team)
                    continue;
                const dirFromKingToRook = (0, functions_1.normaliseDirection)(pos.x, rookPos.x);
                if (dirFromKingToRook === 0)
                    throw new Error("Bruh dir from king is 0");
                const kingEndXval = (dirFromKingToRook > 0) ? 6 : 2;
                const rookEndXval = (dirFromKingToRook > 0) ? 5 : 3;
                // Check no pieces are in the way for the king
                const normalisedDirForKing = (0, functions_1.normaliseDirection)(pos.x, kingEndXval);
                let piecesInWayForKing = [];
                let kingCheckPos = {
                    x: pos.x + normalisedDirForKing,
                    y: pos.y
                };
                while (kingCheckPos.x !== kingEndXval + normalisedDirForKing) {
                    const piece = board.getPos(kingCheckPos);
                    if (piece)
                        piecesInWayForKing.push(piece);
                    kingCheckPos.x += normalisedDirForKing;
                }
                if ((piecesInWayForKing.length === 1 && piecesInWayForKing[0].code === 'r' && piecesInWayForKing[0].team === this.team) || piecesInWayForKing.length === 0) {
                    // Check no pieces are in the way for the rook
                    const normalisedDirForRook = (0, functions_1.normaliseDirection)(rookPos.x, rookEndXval);
                    let piecesInWayForRook = [];
                    let rookCheckPos = {
                        x: rookPos.x + normalisedDirForRook,
                        y: pos.y
                    };
                    while (rookCheckPos.x !== rookEndXval + normalisedDirForRook) {
                        const piece = board.getPos(rookCheckPos);
                        if (piece)
                            piecesInWayForRook.push(piece);
                        rookCheckPos.x += normalisedDirForRook;
                    }
                    if ((piecesInWayForRook.length === 1 && piecesInWayForRook[0].code === 'k' && piecesInWayForRook[0].team === this.team) || piecesInWayForRook.length === 0) {
                        const rook = board.getPos(rookPos);
                        // Ensure the king isn't at any point in check
                        kingCheckPos = {
                            x: pos.x + normalisedDirForKing,
                            y: pos.y
                        };
                        let inCheck = false;
                        const newBoard = new board_1.default(board);
                        newBoard.setPos(rookPos, null);
                        while (kingCheckPos.x !== kingEndXval + normalisedDirForKing) {
                            newBoard.doMove({
                                x: kingCheckPos.x - normalisedDirForKing,
                                y: pos.y
                            }, kingCheckPos);
                            inCheck = !!(newBoard.inCheck(this.team).length);
                            if (inCheck)
                                break;
                            kingCheckPos.x += normalisedDirForKing;
                        }
                        if (!inCheck) {
                            newBoard.setPos({ "x": rookEndXval, "y": pos.y }, rook);
                            newBoard.castleInfo[this.team] = [];
                            moves.push({
                                move: { "x": rookPos.x, "y": pos.y },
                                board: new board_1.default(newBoard),
                                moveType: ["castleKingSide", 'captureRookCastle'],
                                // displayVector: { x: 5, y: pos.y }
                            });
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