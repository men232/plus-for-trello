/**
 * @param {import('./sqlocal').SQLocal} client
 */
export function createExecutor(client) {
  return async function _execute(sql, values, withDetails) {
    if (!Array.isArray(values)) {
      values = values !== undefined ? [values] : [];
    }

    console.log("[SQL]", sql);

    const [raws, rawsLastRowId, rawsChanges] = await Promise.all([
      client.exec(sql, values, "all"),
      withDetails ? client.exec("SELECT last_insert_rowid()", [], "all") : null,
      withDetails ? client.exec("SELECT changes()", [], "all") : 0,
    ]);

    let insertId = rawsLastRowId?.rows?.[0]?.[0] ?? null;
    let rowsAffected = rawsChanges?.rows?.[0]?.[0] ?? 0;

    const rows = convertRowsToObjects(raws.rows, raws.columns);

    const result = { rows, insertId, rowsAffected };

    return result;
  };
}

function isArrayOfArrays(rows) {
  return !rows.some((row) => !Array.isArray(row));
}

function convertRowsToObjects(rows, columns) {
  let checkedRows;
  if (isArrayOfArrays(rows)) {
    checkedRows = rows;
  } else {
    checkedRows = [rows];
  }
  return checkedRows.map((row) => {
    const rowObj = {};
    columns.forEach((column, columnIndex) => {
      rowObj[column] = row[columnIndex];
    });
    return rowObj;
  });
}
