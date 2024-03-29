import Board from './default/board'
import Piece from './default/pieces'

type PieceCodes = 'p' | 'r' | 'n' | 'b' | 'q' | 'k';
type Teams = 'white' | 'black';
type PieceAtPos = Piece | null
type GameModes = 'standard' | '960' | 'fourkings'


interface Vector {
    x: number;
    y: number;
}

interface BoardPos {
    x: number
    y: number
    seg?: number
}

interface MovesAndBoard {
    move: Vector,
    board: Board,
    moveType: string[],
    displayVector?: Vector
}

interface VectorsAndPieces {
    pieces: Piece[];
    vectors: MovesAndBoard[];
}

export type { GameModes, PieceCodes, BoardPos, Teams, Vector, MovesAndBoard, PieceAtPos, VectorsAndPieces }