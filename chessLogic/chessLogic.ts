import { PieceCodes, Teams, Vector, PieceAtPos, GameModes } from './types'
import { convertToChessNotation } from './standard/functions'
import { Queen, Rook, Bishop, Knight, ChessPiece, Pawn, King } from './standard/pieces'
import GameStandard from './standard/game'
import GameFisherRandom from './960/game'
import Board from './default/board'

function getChessGame(mode: GameModes) {
    if (mode === 'standard')
        return GameStandard
    if (mode === '960') {
        return GameFisherRandom
    }
    return GameStandard
}

export { Board as ChessBoardType, getChessGame, ChessPiece, King, Queen, Rook, Bishop, Knight, Pawn, convertToChessNotation }
export type { Teams, Vector, PieceCodes, PieceAtPos }