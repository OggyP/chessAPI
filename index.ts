import express from 'express'
import v1 from './v1/index'
import cors from 'cors'
import runWS from './webSocket';

var app = express();


var whitelist = ['https://chess.oggyp.com', 'https://chesstest.oggyp.com', 'http://localhost:3012', 'http://localhost:3013']
var corsOptionsDelegate = function (req: any, callback: any) {
    var corsOptions;
    const origin = req.header('Origin')
    if (whitelist.indexOf(origin) !== -1 || !origin) {
        corsOptions = { origin: true } // reflect (enable) the requested origin in the CORS response
    } else {
        corsOptions = { origin: false } // disable CORS for this request
    }
    callback(null, corsOptions) // callback expects two parameters: error and options
}

app.use(cors(corsOptionsDelegate))

app.use(express.json()); //Used to parse JSON bodies

app.get('/', function (req, res) {
    res.send("Welocme to the OggyP Chess API!");
});

app.use('/v1', v1)

app.listen(3005);

runWS()