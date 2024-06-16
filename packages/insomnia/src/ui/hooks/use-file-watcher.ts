import { useEffect, useState } from 'react';
export const useFileWatcher = ({ filePath }: { filePath?: string }) => {
  const [fileContent, setFileContent] = useState('');

  useEffect(() => {
    if (!filePath) {
      return;
    }
    window.main.watchFile({ filePath });
    window.main.on('file-changed', (event, { content }) => {
      // console.log(`File changed: ${content}`);
      setFileContent(content);
    });
    window.main.readFile({ filePath }).then((content: string) => {
      // console.log('read', content);
      setFileContent(content);
    });
    // setFileContent(timelineString);
  }, [filePath]);

  // const fetchFileContent = async (filePath: string) => {

  //   const rawBuffer = await fs.promises.readFile(filePath);
  //   const timelineString = rawBuffer.toString();
  //   // const timelineParsed = timelineString.split('\n').filter(e => e?.trim()).map(e => JSON.parse(e));
  //   setFileContent(timelineString);
  // };

  return fileContent;
};
