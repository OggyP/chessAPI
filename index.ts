import express from 'express'
import v2 from './v2/index'
import cors from 'cors'
import runWS from './webSocket';

var app = express();


var whitelist = ['https://chess.oggyp.com', 'http://localhost:3000', 'https://localhost:3000', 'http://192.168.1.199:3000']
var corsOptionsDelegate = function (req: any, callback: any) {
    var corsOptions;
    const origin = req.header('Origin')
    console.log(origin)
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

app.use('/v2', v2)

app.listen(3005);

runWS()