import mysql from 'mysql'

var con = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE
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