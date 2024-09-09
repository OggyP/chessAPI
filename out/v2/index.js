"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const account_1 = __importDefault(require("./account"));
const games_1 = __importDefault(require("./games"));
const user_1 = __importDefault(require("./user"));
let router = express_1.default.Router();
router.use('/account', account_1.default);
router.use('/games', games_1.default);
router.use('/user', user_1.default);
exports.default = router;
//# sourceMappingURL=index.js.map