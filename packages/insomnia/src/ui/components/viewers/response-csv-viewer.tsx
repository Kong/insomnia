import Papa from 'papaparse';
import React, { useCallback, useEffect, useState } from 'react';

interface Props {
  body: Buffer;
}

export const ResponseCSVViewer: React.FC<Props> = ({ body }) => {
  const [csv, setCSV] = useState<{ data: string[][] } | null>(null);
  const parse = useCallback(() =>
    Papa.parse<string[]>(body.toString('utf8'), {
      skipEmptyLines: true,
      complete: result => {
        setCSV(result);
      },
    }), [body]);
  useEffect(() => {
    parse();
  }, [parse]);

  return (
    <div className="pad-sm">
      {csv ?
        <table className="table--fancy table--striped table--compact selectable">
          <tbody>
            {csv.data.map((row, index) => (
            // eslint-disable-next-line react/no-array-index-key -- data structure is unknown, cannot compute a valid key
              <tr key={index}>
                {row.map(c => (
                  <td key={c}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        : 'Parsing CSV...'}
    </div>);
};
