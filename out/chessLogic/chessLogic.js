"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertToChessNotation = exports.Pawn = exports.Knight = exports.Bishop = exports.Rook = exports.Queen = exports.King = exports.ChessPiece = exports.ChessBoardType = void 0;
exports.getChessGame = getChessGame;
const functions_1 = require("./standard/functions");
Object.defineProperty(exports, "convertToChessNotation", { enumerable: true, get: function () { return functions_1.convertToChessNotation; } });
const pieces_1 = require("./standard/pieces");
Object.defineProperty(exports, "Queen", { enumerable: true, get: function () { return pieces_1.Queen; } });
Object.defineProperty(exports, "Rook", { enumerable: true, get: function () { return pieces_1.Rook; } });
Object.defineProperty(exports, "Bishop", { enumerable: true, get: function () { return pieces_1.Bishop; } });
Object.defineProperty(exports, "Knight", { enumerable: true, get: function () { return pieces_1.Knight; } });
Object.defineProperty(exports, "ChessPiece", { enumerable: true, get: function () { return pieces_1.ChessPiece; } });
Object.defineProperty(exports, "Pawn", { enumerable: true, get: function () { return pieces_1.Pawn; } });
Object.defineProperty(exports, "King", { enumerable: true, get: function () { return pieces_1.King; } });
const game_1 = __importDefault(require("./standard/game"));
const game_2 = __importDefault(require("./960/game"));
const game_3 = __importDefault(require("./fourkings/game"));
const board_1 = __importDefault(require("./default/board"));
exports.ChessBoardType = board_1.default;
function getChessGame(mode) {
    if (mode === 'standard')
        return game_1.default;
    if (mode === '960')
        return game_2.default;
    if (mode === 'fourkings')
        return game_3.default;
    return game_1.default;
}
//# sourceMappingURL=chessLogic.js.map