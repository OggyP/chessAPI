"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class ChessPiece {
    team;
    code;
    key;
    constructor(team, pieceCode, pieceId) {
        this.team = team;
        this.code = pieceCode;
        this.key = pieceId;
    }
    getMoves(pos, board) {
        return [];
    }
    getTeam() {
        return this.team;
    }
}
exports.default = ChessPiece;
//# sourceMappingURL=pieces.js.map