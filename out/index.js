"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const index_1 = __importDefault(require("./v2/index"));
const cors_1 = __importDefault(require("cors"));
const webSocket_1 = __importDefault(require("./webSocket"));
var app = (0, express_1.default)();
var whitelist = ['https://chess.oggyp.com', 'http://localhost:3000', 'https://localhost:3000', 'http://192.168.1.199:3000'];
var corsOptionsDelegate = function (req, callback) {
    var corsOptions;
    const origin = req.header('Origin');
    if (whitelist.indexOf(origin) !== -1 || !origin) {
        corsOptions = { origin: true }; // reflect (enable) the requested origin in the CORS response
    }
    else {
        corsOptions = { origin: false }; // disable CORS for this request
    }
    callback(null, corsOptions); // callback expects two parameters: error and options
};
app.use((0, cors_1.default)(corsOptionsDelegate));
app.use(express_1.default.json()); //Used to parse JSON bodies
app.get('/', function (req, res) {
    res.send("Welocme to the OggyP Chess API!");
});
app.use('/v2', index_1.default);
app.listen(3005);
(0, webSocket_1.default)();
//# sourceMappingURL=index.js.map