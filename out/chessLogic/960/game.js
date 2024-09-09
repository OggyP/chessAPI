"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const board_1 = __importDefault(require("./board"));
const functions_1 = require("./functions");
const pieces_1 = require("./pieces");
const startingPosition_1 = __importDefault(require("./startingPosition"));
const openings_json_1 = __importDefault(require("../../openings.json"));
class Game {
    static genBoard = () => (0, startingPosition_1.default)(Math.floor(Math.random() * 961));
    _history = [];
    shortNotationMoves = '';
    gameOver = false;
    startingFEN;
    metaValues;
    metaValuesOrder;
    opening = {
        "Name": "Custom Position",
        "ECO": null
    };
    constructor(input) {
        this.metaValuesOrder = ['Event', 'Site', 'Date', 'Round', 'White', 'Black', 'WhiteElo', 'BlackElo', 'Result', 'Variant', 'TimeControl', 'ECO', 'Opening', 'FEN'];
        if (input.pgn) {
            // Parse PGN
            this.startingFEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w AHah - 0 1";
            const currentDate = new Date();
            this.metaValues = new Map([
                ['Event', '?'],
                ['Site', 'https://chess.oggyp.com'],
                ['Date', currentDate.getFullYear() + '.' + currentDate.getMonth() + '.' + currentDate.getDate()],
                ['Round', '?'],
                ['White', '?'],
                ['Black', '?'],
                ['Result', '*'],
                ['Variant', 'Standard'],
                ['TimeControl', '-'],
                ['ECO', '?'],
                ['Opening', '?']
            ]);
            let lines = input.pgn.split('\n');
            const lastLine = lines.pop()?.split('{');
            let lastLineParsed = lastLine[0];
            for (let i = 1; i < lastLine?.length; i++) {
                const splitExtraComment = lastLine[i].split(') ');
                if (splitExtraComment.length === 2)
                    lastLineParsed += splitExtraComment[1];
                else
                    lastLineParsed += lastLine[i].split('} ')[1];
            }
            lastLineParsed = lastLineParsed.replace(/\?(!|)/g, '');
            lastLineParsed = lastLineParsed.replace(/\.\.\./g, '.');
            const moves = lastLineParsed.split(' ');
            if (moves.length === 1 && moves[0] === '')
                moves.pop();
            this.metaValuesOrder = [];
            if (!moves)
                return;
            lines.forEach(line => {
                if (!line)
                    return; // ignore empty lines
                const words = line.split(' ');
                const metaValueName = words[0].replace('[', '');
                this.metaValues.set(metaValueName, line.split('"')[1]);
                if (!this.metaValuesOrder.includes(metaValueName))
                    this.metaValuesOrder.push(metaValueName);
            });
            if (this.metaValues.has('FEN'))
                this.startingFEN = this.metaValues.get('FEN');
            let board = new board_1.default(this.startingFEN);
            this._history = [{
                    board: new board_1.default(board),
                    text: "Starting Position",
                    move: null
                }];
            let turn = 'white';
            for (let i = 0; i < moves.length; i++) {
                const originalPGNmove = moves[i];
                let move = moves[i].replace('+', '').replace('#', '');
                if (!isNaN(Number(move[0]))) {
                    if (i === moves.length - 1) {
                        const gameOverScoreToWinner = new Map([
                            ['1-0', 'white',],
                            ['1/2-1/2', 'draw'],
                            ['0-1', 'black']
                        ]);
                        const winner = gameOverScoreToWinner.get(move);
                        if (winner)
                            this.setGameOver({
                                winner: winner,
                                by: 'Unknown'
                            });
                    }
                    continue;
                }
                if (move === 'O-O-O' || move === '0-0-0' || move === 'O-O' || move === '0-0') { // O and 0 just to be sure 
                    const kingRow = (turn === 'white') ? 7 : 0;
                    const lookingForTag = (move === 'O-O' || move === '0-0') ? 'castleKingSide' : 'castleQueenSide';
                    let moveFound = false;
                    for (let x = 0; x < 8; x++) {
                        const pos = {
                            x: x,
                            y: kingRow
                        };
                        const piece = board.getPos(pos);
                        if (piece && piece.team === turn) {
                            const movesList = piece.getMoves(pos, board);
                            for (let i = 0; i < movesList.length; i++) {
                                const checkMove = movesList[i];
                                if (checkMove.moveType.includes(lookingForTag)) {
                                    board = new board_1.default(checkMove.board);
                                    this.newMove({
                                        board: checkMove.board,
                                        text: originalPGNmove,
                                        move: {
                                            start: pos,
                                            end: checkMove.move,
                                            type: checkMove.moveType,
                                            notation: {
                                                short: originalPGNmove,
                                                long: (0, functions_1.convertToChessNotation)(pos) + (0, functions_1.convertToChessNotation)(checkMove.move)
                                            }
                                        }
                                    });
                                    moveFound = true;
                                    break;
                                }
                            }
                        }
                    }
                    if (!moveFound) {
                        console.warn('No legal castle found. ', board.getFen());
                        break;
                    }
                }
                else if (move[0] === move[0].toLowerCase()) {
                    // pawn move
                    let startingPos = { 'x': (0, functions_1.convertToPosition)(move[0], 'x'), 'y': -1 };
                    let endingPos;
                    if (move.includes('x'))
                        move = move.split('x')[1];
                    endingPos = (0, functions_1.convertToPosition)(move);
                    // now we need to find the starting y value
                    let moveInfo = null;
                    for (let y = 0; y < 8 && !moveInfo; y++) {
                        if (y === startingPos.y)
                            continue;
                        startingPos.y = y;
                        const piece = board.getPos(startingPos);
                        if (piece && piece instanceof pieces_1.Pawn && piece.team === turn) {
                            let moves = piece.getMoves(startingPos, board);
                            for (let i = 0; i < moves.length; i++) {
                                const checkMove = moves[i];
                                if (checkMove.move.x === endingPos.x && checkMove.move.y === endingPos.y) {
                                    board = new board_1.default(checkMove.board);
                                    moveInfo = {
                                        board: checkMove.board,
                                        text: originalPGNmove,
                                        move: {
                                            start: startingPos,
                                            end: endingPos,
                                            type: checkMove.moveType,
                                            notation: {
                                                short: originalPGNmove,
                                                long: (0, functions_1.convertToChessNotation)(startingPos) + (0, functions_1.convertToChessNotation)(endingPos)
                                            }
                                        }
                                    };
                                    break;
                                }
                            }
                        }
                    }
                    if (!moveInfo) {
                        console.warn("No legal pawn move was found. ", board.getFen());
                        break;
                    }
                    if (move[2] === '=') {
                        moveInfo.board.promote(endingPos, move.split('=')[1].toLowerCase(), turn);
                        if (moveInfo.move)
                            moveInfo.move.notation.long += move.split('=')[1].toLowerCase();
                        board = new board_1.default(moveInfo.board);
                    }
                    this.newMove(moveInfo);
                }
                else {
                    // other piece move
                    move = move.replace('x', '');
                    const pieceType = move[0].toLowerCase();
                    const endingPos = (0, functions_1.convertToPosition)(move.slice(-2));
                    const requirementsOptions = move.slice(1, -2);
                    let requirements = {
                        'x': null,
                        'y': null,
                    };
                    for (let j = 0; j < requirementsOptions.length; j++) {
                        if (isNaN(Number(requirementsOptions[j])))
                            // Letter X
                            requirements.x = (0, functions_1.convertToPosition)(requirementsOptions[j], 'x');
                        else
                            // Number Y
                            requirements.y = (0, functions_1.convertToPosition)(requirementsOptions[j], 'y');
                    }
                    let pos = { "x": 0, "y": 0 };
                    let foundMove = false;
                    for (pos.x = 0; pos.x < 8 && !foundMove; pos.x++)
                        for (pos.y = 0; pos.y < 8 && !foundMove; pos.y++)
                            if (pos.x !== endingPos.x || pos.y !== endingPos.y) {
                                if (requirements.x && requirements.x !== pos.x)
                                    continue;
                                if (requirements.y && requirements.y !== pos.y)
                                    continue;
                                let piece = board.getPos(pos);
                                if (!piece || piece.team !== turn || piece.code !== pieceType)
                                    continue;
                                let moves = piece.getMoves(pos, board);
                                for (let i = 0; i < moves.length; i++) {
                                    const checkMove = moves[i];
                                    if (checkMove.move.x === endingPos.x && checkMove.move.y === endingPos.y) {
                                        foundMove = true;
                                        board = new board_1.default(checkMove.board);
                                        this.newMove({
                                            board: checkMove.board,
                                            text: originalPGNmove,
                                            move: {
                                                start: { 'x': pos.x, 'y': pos.y },
                                                end: endingPos,
                                                type: checkMove.moveType,
                                                notation: {
                                                    short: originalPGNmove,
                                                    long: (0, functions_1.convertToChessNotation)(pos) + (0, functions_1.convertToChessNotation)(endingPos)
                                                }
                                            }
                                        });
                                        break;
                                    }
                                }
                            }
                    if (!foundMove) {
                        console.warn("No legal normal move found at " + originalPGNmove + " | " + board.getFen() + " Current turn: " + turn + '');
                        break;
                    }
                }
                turn = (turn === 'white') ? 'black' : 'white'; // invert team
                this.gameOver = board.isGameOverFor(turn);
            }
        }
        else if (input.fen) {
            if (input.fen.meta)
                this.metaValues = input.fen.meta;
            else {
                const currentDate = new Date();
                this.metaValues = new Map([
                    ['Event', '?'],
                    ['Site', 'https://chess.oggyp.com'],
                    ['Date', currentDate.getFullYear() + '.' + currentDate.getMonth() + '.' + currentDate.getDate()],
                    ['Round', '?'],
                    ['White', '?'],
                    ['Black', '?'],
                    ['Result', '*'],
                    ['Variant', 'Standard'],
                    ['TimeControl', '-'],
                    ['ECO', '?'],
                    ['Opening', '?'],
                    ['FEN', input.fen.val]
                ]);
            }
            this._history = [{
                    board: new board_1.default(input.fen.val),
                    text: "Starting Position",
                    move: null
                }];
            this.startingFEN = input.fen.val;
        }
        else
            throw (new Error("You must specify either a FEN or PGN to track game history."));
    }
    checkForOpening() {
    }
    getPlayerInfo() {
        if (this.metaValues.has('White') && this.metaValues.has('Black') && (this.metaValues.get('White') !== '?' || this.metaValues.get('Black') !== '?')) {
            let ratings = {
                white: (this.metaValues.has('WhiteElo')) ? Number(this.metaValues.get('WhiteElo')) : 0,
                black: (this.metaValues.has('BlackElo')) ? Number(this.metaValues.get('BlackElo')) : 0
            };
            return {
                white: {
                    username: this.metaValues.get('White'),
                    rating: ratings.white
                },
                black: {
                    username: this.metaValues.get('Black'),
                    rating: ratings.black
                }
            };
        }
        return null;
    }
    setGameOver(gameOver) {
        this.gameOver = gameOver;
        if (this.gameOver) {
            const gameOverWinTypes = {
                'white': '1-0',
                'draw': '1/2-1/2',
                'black': '0-1'
            };
            if (this.metaValues.has('Result'))
                this.metaValues.set('Result', gameOverWinTypes[this.gameOver.winner]);
        }
    }
    getMoveCount() {
        return this._history.length - 1;
    }
    getMove(moveNum) {
        return this._history[moveNum];
    }
    getLatest() {
        return this._history[this.getMoveCount()];
    }
    isGameOver() {
        const gameOverInfo = this.getLatest().board.isGameOverFor(this.getLatest().board.getTurn('next'));
        if (gameOverInfo) {
            const gameOverWinTypes = {
                'white': '1-0',
                'draw': '1/2-1/2',
                'black': '0-1'
            };
            const gameOverType = gameOverWinTypes[gameOverInfo.winner];
            if (this.metaValues.has('Result'))
                this.metaValues.set('Result', gameOverType);
            this.gameOver = gameOverInfo;
        }
        return gameOverInfo;
    }
    doMove(startPos, endPos, promotion = undefined, allowPromotion = true) {
        const latestBoard = this.getLatest().board;
        const piece = latestBoard.getPos(startPos);
        if (!piece)
            return `Wrong piece being moved\n${latestBoard.getFen()}`;
        if (piece.team !== latestBoard.getTurn('next'))
            return `It is not your turn\n${latestBoard.getFen()}`;
        const moves = piece.getMoves(startPos, latestBoard);
        for (let i = 0; i < moves.length; i++) {
            const move = moves[i];
            if (!allowPromotion && move.moveType.includes('promote'))
                return `Attempted to promote\n${latestBoard.getFen()}`;
            if (move.move.x !== endPos.x || move.move.y !== endPos.y)
                continue;
            const newBoard = new board_1.default(move.board);
            if (promotion) {
                if (!['p', 'r', 'n', 'b', 'q', 'k'].includes(promotion))
                    return `Invalid promotion piece ${promotion}`;
                newBoard.promote(endPos, promotion, newBoard.getTurn('prev'));
            }
            const isGameOver = newBoard.isGameOverFor(newBoard.getTurn('next'));
            const shortNotation = newBoard.getShortNotation(startPos, endPos, move.moveType, latestBoard, (isGameOver && isGameOver.by === 'checkmate') ? "#" : ((newBoard.inCheck(newBoard.getTurn('next')).length ? '+' : '')), promotion);
            this.newMove({
                board: newBoard,
                text: shortNotation,
                move: {
                    start: startPos,
                    end: endPos,
                    type: move.moveType,
                    notation: {
                        short: shortNotation,
                        long: (0, functions_1.convertToChessNotation)(startPos) + (0, functions_1.convertToChessNotation)(endPos) + ((promotion) ? promotion : '')
                    }
                }
            });
            this.setGameOver(isGameOver);
            return true;
        }
        return `No legal move found\n${latestBoard.getFen()}`;
    }
    newMove(move) {
        this._history.push(move);
        let i = this.getMoveCount();
        const moveInfo = move.move;
        if (moveInfo) {
            if (i % 2 === 1) {
                this.shortNotationMoves += ((i !== 1) ? ' ' : '') + ((i - 1) / 2 + 1) + '.';
            }
            this.shortNotationMoves += ' ' + moveInfo.notation.short;
        }
    }
    resetToMove(moveNum) {
        const newHistory = this._history.slice(0, moveNum + 1);
        this._history = newHistory;
        this.shortNotationMoves = '';
        for (let i = 0; i < this._history.length; i++) {
            const move = this._history[i];
            const moveInfo = move.move;
            if (moveInfo) {
                if (i % 2 === 1) {
                    this.shortNotationMoves += ((i !== 1) ? ' ' : '') + ((i - 1) / 2 + 1) + '.';
                }
                this.shortNotationMoves += ' ' + moveInfo.notation.short;
            }
        }
        const opening = openings_json_1.default[this.shortNotationMoves];
        if (this.getMoveCount() < 25 && opening) {
            this.metaValues.set('Opening', opening.Name);
            this.metaValues.set('ECO', opening.ECO);
            this.opening = opening;
        }
    }
    getPGN() {
        let pgn = '';
        this.metaValuesOrder.forEach(value => {
            pgn += `[${value} "${this.metaValues.get(value)}"]\n`;
        });
        pgn += '\n' + this.shortNotationMoves;
        const gameOverWinTypes = {
            'white': '1-0',
            'draw': '1/2-1/2',
            'black': '0-1'
        };
        if (this.gameOver)
            pgn += ' ' + gameOverWinTypes[this.gameOver.winner];
        return pgn;
    }
    // Returns the moves in long notation from the starting position
    getMovesTo(halfMoveNum) {
        let moves = [];
        for (let i = 0; i <= halfMoveNum; i++) {
            const move = this._history[i].move;
            if (move)
                moves.push(move.notation.long);
        }
        return moves;
    }
}
exports.default = Game;
//# sourceMappingURL=game.js.map