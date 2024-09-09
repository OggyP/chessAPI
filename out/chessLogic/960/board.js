"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const functions_1 = require("./functions");
const pieces_1 = require("./pieces");
const board_1 = __importDefault(require("../default/board"));
class Board extends board_1.default {
    _squares;
    enPassant = null;
    halfMoveNumber;
    halfMovesSinceCaptureOrPawnMove;
    castleInfo = {
        "white": [],
        "black": []
    };
    capturedPieces = {
        white: [],
        black: []
    };
    _pieceId = 0;
    _repitions = new Map();
    constructor(input = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w AHah - 0 1") {
        super('standard');
        this._squares = [];
        for (let i = 0; i < 8; i++)
            this._squares.push([]);
        if (typeof input !== 'string') {
            let board = input;
            for (let i = 0; i < 8; i++)
                this._squares[i] = Object.assign([], board._squares[i]);
            this.halfMoveNumber = board.halfMoveNumber;
            this.halfMovesSinceCaptureOrPawnMove = board.halfMovesSinceCaptureOrPawnMove;
            this.castleInfo.white = Object.assign([], board.castleInfo.white);
            this.castleInfo.black = Object.assign([], board.castleInfo.black);
            this.enPassant = board.enPassant;
            this.capturedPieces.white = Object.assign([], board.capturedPieces.white);
            this.capturedPieces.black = Object.assign([], board.capturedPieces.black);
            this._pieceId = board._pieceId;
            this._repitions = new Map(board._repitions);
        }
        else {
            let FENparts = input.split(' ');
            if (FENparts.length !== 6) {
                console.error("Invalid FEN, There should be 6 segments. The input FEN was " + input);
                input = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w AHah - 0 1";
                FENparts = input.split(' ');
            }
            let rows = FENparts[0].split('/');
            if (rows.length !== 8) {
                console.error("Invalid FEN, there needs to be 8 rows specified.");
                input = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w AHah - 0 1";
                FENparts = input.split(' ');
                rows = FENparts[0].split('/');
            }
            let turn = (FENparts[1] === 'w') ? "white" : "black";
            this.capturedPieces = {
                white: [],
                black: []
            };
            // Set Castling
            const letterToCol = {
                a: 0,
                b: 1,
                c: 2,
                q: 2,
                d: 3,
                e: 4,
                f: 5,
                g: 6,
                k: 6,
                h: 7
            };
            for (let i = 0; i < FENparts[2].length; i++) {
                let char = FENparts[2][i];
                if (char !== '-') {
                    let teamOfCastlingInfo = (char === char.toUpperCase()) ? "white" : "black";
                    this.castleInfo[teamOfCastlingInfo].push(letterToCol[char.toLowerCase()]);
                }
            }
            // Set Enpassant
            if (FENparts[3] !== '-')
                this.enPassant = (0, functions_1.convertToPosition)(FENparts[3]);
            this.halfMovesSinceCaptureOrPawnMove = Number(FENparts[4]);
            this.halfMoveNumber = (Number(FENparts[5]) - 1) * 2;
            if (turn === "black")
                this.halfMoveNumber++;
            this._repitions.set(FENparts[0], 1);
            // Set Pieces
            for (let rowNum = 0; rowNum < 8; rowNum++) {
                let row = rows[rowNum];
                for (let i = 0; i < row.length; i++) {
                    let char = row[i];
                    if (!isNaN(Number(char))) {
                        // Fill with null for specified amount
                        for (let j = 0; j < Number(char); j++) {
                            this._squares[rowNum].push(null);
                        }
                    }
                    else {
                        let lowerCaseChar = char.toLowerCase();
                        if (pieces_1.pieceCodeClasses[lowerCaseChar] !== undefined) {
                            this._pieceId++;
                            if (char.toUpperCase() === char) {
                                // Piece is white
                                this._squares[rowNum].push(new pieces_1.pieceCodeClasses[lowerCaseChar]("white", this._pieceId));
                            }
                            else {
                                // Piece is black
                                this._squares[rowNum].push(new pieces_1.pieceCodeClasses[lowerCaseChar]("black", this._pieceId));
                            }
                        }
                    }
                }
            }
        }
    }
    doMove(pieceStartingPos, pieceEndingPos) {
        const pieceToMove = this._squares[pieceStartingPos.y][pieceStartingPos.x];
        if (pieceToMove) {
            this._squares[pieceEndingPos.y][pieceEndingPos.x] = new pieces_1.pieceCodeClasses[pieceToMove.code](pieceToMove.team, pieceToMove.key);
            this._squares[pieceStartingPos.y][pieceStartingPos.x] = null;
        }
        this.enPassant = null;
    }
    promote(pos, pieceCode, promoteTeam) {
        this._pieceId++;
        this.setPos(pos, new pieces_1.pieceCodeClasses[pieceCode](promoteTeam, this._pieceId));
        this.capturedPieces[promoteTeam].push(pieceCode);
        this.capturedPieces[(promoteTeam === 'white') ? 'black' : 'white'].push('p');
    }
    // prev is the move that has just been played
    // next is whose turn it is to be done now
    getTurn(type) {
        if (type === 'prev')
            return (this.halfMoveNumber % 2) ? "white" : "black";
        else
            return (this.halfMoveNumber % 2) ? "black" : "white";
    }
    isGameOverFor(team) {
        let legalMoves = false;
        let pos = { "x": 0, "y": 0 };
        for (pos.x = 0; pos.x < 8 && !legalMoves; pos.x++)
            for (pos.y = 0; pos.y < 8 && !legalMoves; pos.y++) {
                let piece = this.getPos(pos);
                if (piece && piece.team === team)
                    legalMoves = piece.getMoves(pos, this).length > 0;
            }
        if (legalMoves) {
            if (this.halfMovesSinceCaptureOrPawnMove >= 100)
                return { by: '50 move rule', winner: "draw" };
            const position = this.getFen().split(' ')[0];
            if (this._repitions.has(position)) {
                const repitions = this._repitions.get(position) + 1;
                this._repitions.set(position, repitions);
                if (repitions >= 3)
                    return { by: "repitition", winner: "draw" };
            }
            else {
                this._repitions.set(position, 1);
            }
            return false;
        }
        else {
            if (this.inCheck(team).length)
                return { by: "checkmate", winner: (team === 'white') ? "black" : "white" };
            else
                return { by: "stalemate", extraInfo: team + " in stalemate", winner: "draw" };
        }
    }
    getFen() {
        let FEN = "";
        for (let i = 0; i < 8; i++) {
            let emptySpaceCount = 0;
            for (let j = 0; j < 8; j++) {
                const currentSquareToCheck = this._squares[i][j];
                if (currentSquareToCheck) {
                    let pieceFENcode = (currentSquareToCheck.team === 'white') ? currentSquareToCheck.code.toUpperCase() : currentSquareToCheck.code;
                    if (emptySpaceCount > 0) {
                        FEN += emptySpaceCount.toString();
                    }
                    FEN += pieceFENcode;
                    emptySpaceCount = 0;
                }
                else {
                    emptySpaceCount++;
                }
            }
            if (emptySpaceCount > 0) {
                FEN += emptySpaceCount.toString();
            }
            FEN += "/";
        }
        FEN = FEN.slice(0, -1); // Remove excess '/'
        FEN += ` ${this.getTurn('next')[0]}`;
        let castlingToAdd = '';
        const colToLetter = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        for (let col of this.castleInfo.white) {
            castlingToAdd += colToLetter[col].toUpperCase();
        }
        for (let col of this.castleInfo.black) {
            castlingToAdd += colToLetter[col];
        }
        if (castlingToAdd.length)
            FEN += ' ' + castlingToAdd;
        else
            FEN += ' -';
        if (this.enPassant)
            FEN += ' ' + (0, functions_1.convertToChessNotation)(this.enPassant);
        else
            FEN += ' -';
        FEN += ` ${this.halfMovesSinceCaptureOrPawnMove} ${1 + Math.floor(this.halfMoveNumber / 2)}`;
        return FEN;
    }
    swapPositions() {
        let pos = { "x": 0, "y": 0 };
        for (pos.x = 0; pos.x < 8; pos.x++)
            for (pos.y = 0; pos.y < 8; pos.y++) {
                const pieceAtPos = this._squares[pos.y][pos.x];
                if (pieceAtPos)
                    this._squares[pos.y][pos.x] = this._squares[pos.y][pos.x] = new pieces_1.pieceCodeClasses[pieceAtPos.code]((pieceAtPos.team === 'white') ? 'black' : 'white', this._pieceId);
            }
    }
    areLegalMoves(team) {
        let pos = { "x": 0, "y": 0 };
        for (pos.x = 0; pos.x < 8; pos.x++)
            for (pos.y = 0; pos.y < 8; pos.y++) {
                const piece = this._squares[pos.y][pos.x];
                if (piece && piece.team === team && piece.getMoves(pos, this).length)
                    return true;
            }
        return false;
    }
    inCheck(team) {
        let checkPositions = [];
        let pos = { "x": 0, "y": 0 };
        for (pos.x = 0; pos.x < 8; pos.x++)
            for (pos.y = 0; pos.y < 8; pos.y++) {
                let piece = this._squares[pos.y][pos.x];
                if (piece instanceof pieces_1.King && piece.team === team) {
                    // Now we have the correct King to check
                    const QueenAndRookBoardPoss = [
                        { "x": 0, "y": 1 },
                        { "x": 1, "y": 0 },
                        { "x": 0, "y": -1 },
                        { "x": -1, "y": 0 }
                    ];
                    let pieces = (0, functions_1.getRayCastVectors)(this, QueenAndRookBoardPoss, pos, team).pieces;
                    for (let i = 0; i < pieces.length; i++)
                        if (pieces[i] instanceof pieces_1.Queen || pieces[i] instanceof pieces_1.Rook) {
                            checkPositions.push(Object.assign({}, pos));
                            continue;
                        }
                    const QueenAndBishopBoardPoss = [
                        { "x": 1, "y": 1 },
                        { "x": 1, "y": -1 },
                        { "x": -1, "y": -1 },
                        { "x": -1, "y": 1 }
                    ];
                    pieces = (0, functions_1.getRayCastVectors)(this, QueenAndBishopBoardPoss, pos, team).pieces;
                    for (let i = 0; i < pieces.length; i++)
                        if (pieces[i] instanceof pieces_1.Queen || pieces[i] instanceof pieces_1.Bishop) {
                            checkPositions.push(Object.assign({}, pos));
                            continue;
                        }
                    const knightBoardPoss = [
                        { "x": 2, "y": 1 },
                        { "x": 1, "y": 2 },
                        { "x": 2, "y": -1 },
                        { "x": 1, "y": -2 },
                        { "x": -1, "y": -2 },
                        { "x": -2, "y": -1 },
                        { "x": -2, "y": 1 },
                        { "x": -1, "y": 2 }
                    ];
                    pieces = (0, functions_1.getVectors)(this, knightBoardPoss, pos, team).pieces;
                    for (let i = 0; i < pieces.length; i++)
                        if (pieces[i] instanceof pieces_1.Knight) {
                            checkPositions.push(Object.assign({}, pos));
                            continue;
                        }
                    const kingBoardPoss = [
                        { "x": 0, "y": 1 },
                        { "x": 1, "y": 1 },
                        { "x": 1, "y": 0 },
                        { "x": 1, "y": -1 },
                        { "x": 0, "y": -1 },
                        { "x": -1, "y": -1 },
                        { "x": -1, "y": 0 },
                        { "x": -1, "y": 1 },
                    ];
                    pieces = (0, functions_1.getVectors)(this, kingBoardPoss, pos, team).pieces;
                    for (let i = 0; i < pieces.length; i++)
                        if (pieces[i] instanceof pieces_1.King) {
                            checkPositions.push(Object.assign({}, pos));
                            continue;
                        }
                    let pawnBoardPoss;
                    if (team === "white")
                        pawnBoardPoss = [
                            { "x": 1, "y": -1 },
                            { "x": -1, "y": -1 }
                        ];
                    else
                        pawnBoardPoss = [
                            { "x": 1, "y": 1 },
                            { "x": -1, "y": 1 }
                        ];
                    pieces = (0, functions_1.getVectors)(this, pawnBoardPoss, pos, team).pieces;
                    for (let i = 0; i < pieces.length; i++)
                        if (pieces[i] instanceof pieces_1.Pawn) {
                            checkPositions.push(Object.assign({}, pos));
                            continue;
                        }
                }
            }
        return checkPositions;
    }
    getPos(position) {
        if (!position)
            return null;
        if (position.x < 0 || position.x >= 8 || position.y < 0 || position.y >= 8)
            return null;
        return this._squares[position.y][position.x];
    }
    setPos(position, piece) {
        this._squares[position.y][position.x] = piece;
    }
    getShortNotation(startPos, endPos, moveType, startBoard, append, promotionChoice) {
        return Board.getShortNotationStatic(startPos, endPos, moveType, startBoard, append, promotionChoice);
    }
    static getShortNotationStatic(startPos, endPos, moveType, startBoard, append, promotionChoice) {
        const startingPiece = startBoard.getPos(startPos);
        let text = '';
        if (startingPiece) {
            if (startingPiece instanceof pieces_1.Pawn) {
                if (moveType.includes('capture'))
                    text += (0, functions_1.convertToChessNotation)(startPos.x, 'x') + 'x';
                text += (0, functions_1.convertToChessNotation)(endPos);
                if (promotionChoice)
                    text += '=' + promotionChoice.toUpperCase();
            }
            else {
                if (moveType.includes('castleKingSide'))
                    text = "O-O";
                else if (moveType.includes('castleQueenSide'))
                    text = "O-O-O";
                else {
                    let sameX = false;
                    let sameY = false;
                    let pos = { "x": 0, "y": 0 };
                    for (pos.x = 0; pos.x < 8; pos.x++)
                        for (pos.y = 0; pos.y < 8; pos.y++)
                            if (pos.x !== startPos.x || pos.y !== startPos.y) {
                                const piece = startBoard.getPos(pos);
                                if (piece && piece.team === startingPiece.team && piece.code === startingPiece.code) {
                                    const pieceMoves = piece.getMoves(pos, startBoard);
                                    for (let i = 0; i < pieceMoves.length; i++) {
                                        const currentMove = pieceMoves[i];
                                        if (currentMove.move.x === endPos.x && currentMove.move.y === endPos.y) {
                                            if (pos.x === startPos.x)
                                                sameX = true;
                                            else if (pos.y === startPos.y)
                                                sameY = true;
                                            else
                                                sameY = true;
                                        }
                                    }
                                }
                            }
                    text += startingPiece.code.toUpperCase();
                    if (sameY)
                        text += (0, functions_1.convertToChessNotation)(startPos.x, 'x');
                    if (sameX)
                        text += (0, functions_1.convertToChessNotation)(startPos.y, 'y');
                    if (moveType.includes('capture'))
                        text += 'x';
                    text += (0, functions_1.convertToChessNotation)(endPos);
                }
            }
        }
        return text + append;
    }
}
exports.default = Board;
//# sourceMappingURL=board.js.map