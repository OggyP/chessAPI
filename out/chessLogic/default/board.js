"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class DefaultBoard {
    gameMode = null;
    capturedPieces = {
        white: [],
        black: []
    };
    enPassant = null;
    halfMoveNumber = 0;
    constructor(input) {
        if (typeof input === 'string')
            this.gameMode = input;
    }
    promote(pos, pieceCode, promoteTeam) {
    }
    doMove(pieceStartingPos, pieceEndingPos) {
    }
    doNotationMove(move) {
    }
    getTurn(type) {
        return 'white';
    }
    isGameOverFor(team) {
        return false;
    }
    getFen() {
        return 'FEN';
    }
    areLegalMoves(team) {
        return true;
    }
    inCheck(team) {
        return [];
    }
    getPos(position) {
        return null;
    }
    setPos(position, Piece) {
    }
    getShortNotation(startPos, endPos, moveType, startBoard, append, promotionChoice) {
        return 'a1';
    }
}
exports.default = DefaultBoard;
//# sourceMappingURL=board.js.map