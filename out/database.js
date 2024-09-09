"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.con = void 0;
exports.sqlQuery = sqlQuery;
const mysql_1 = __importDefault(require("mysql"));
var con = mysql_1.default.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE
});
exports.con = con;
con.connect(function (err) {
    if (err)
        throw err;
    console.log("MYSQL Connected!");
});
function sqlQuery(sql) {
    return new Promise(function (res) {
        con.query(sql, function (err, result, fields) {
            res({
                result: result,
                fields: fields,
                error: err
            });
        });
    });
}
//# sourceMappingURL=database.js.map