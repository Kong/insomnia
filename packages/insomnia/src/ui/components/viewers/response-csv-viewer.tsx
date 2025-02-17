import Papa from 'papaparse';
import React, { type FC, useEffect, useRef, useState } from 'react';

interface Props {
  body: Buffer;
}

export const ResponseCSVViewer: FC<Props> = ({ body }) => {
  const [csv, setCSV] = useState<{ data: string[][] } | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  useEffect(() => {
    Papa.parse<string[]>(body.toString('utf8'), {
      skipEmptyLines: true,
      complete: result => {
        setCSV(result);
      },
    });
  }, [body]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey && event.key === 'a') {
        event.preventDefault();

        if (tableRef.current) {
          const range = document.createRange();
          range.selectNodeContents(tableRef.current);
          const selection = window.getSelection();
          if (selection) {
            selection.removeAllRanges();
            selection.addRange(range);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div className="pad-sm">
      {csv ?
        <table ref={tableRef} className="table--fancy table--striped table--compact selectable">
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
