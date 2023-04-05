import mysql from 'mysql'
import * as sqlInfo from './userInfo.json'
var con = mysql.createConnection({
    host: "localhost",
    user: sqlInfo.username,
    password: sqlInfo.password,
    database: "chess"
});

con.connect(function (err) {
    if (err) throw err;
    console.log("MYSQL Connected!");
});

function sqlQuery(sql: string) {
    return new Promise<{
        result: any,
        fields: mysql.FieldInfo[] | undefined
        error: mysql.MysqlError | null
    }>(function (res) {
        con.query(sql, function (err, result, fields) {
            res({
                result: result,
                fields: fields,
                error: err
            })
        });
    })
}

export { con, sqlQuery }