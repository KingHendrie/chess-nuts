const { Chess } = require('chess.js');

class ChessGame {
  constructor(fen) {
    this.chess = new Chess(fen);
  }

  getFen() {
    return this.chess.fen();
  }

  getTurn() {
    return this.chess.turn();
  }

  getMoves(options) {
    return this.chess.moves(options);
  }

  move(moveObj) {
    // moveObj: { from: 'e2', to: 'e4', promotion: 'q' }
    return this.chess.move(moveObj);
  }

  undo() {
    return this.chess.undo();
  }

  isGameOver() {
    // chess.js exposes `game_over()` in this project's version
    return typeof this.chess.game_over === 'function' ? this.chess.game_over() : (this.chess.isGameOver ? this.chess.isGameOver() : false);
  }

  getResult() {
    if (!this.isGameOver()) return null;
    // Prefer API names available on the chess instance
    if (typeof this.chess.in_checkmate === 'function' ? this.chess.in_checkmate() : (this.chess.isCheckmate ? this.chess.isCheckmate() : false)) {
      return this.chess.turn() === 'w' ? 'black' : 'white';
    }
    if (typeof this.chess.in_draw === 'function' ? this.chess.in_draw() : (this.chess.isDraw ? this.chess.isDraw() : false)) return 'draw';
    return 'unknown';
  }

  getHistory() {
    return this.chess.history({ verbose: true });
  }
}

module.exports = ChessGame;
