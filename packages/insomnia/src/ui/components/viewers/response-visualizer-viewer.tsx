import React, { useEffect, useState } from 'react';
import { useRouteLoaderData } from 'react-router-dom';

import { useNunjucks } from '../../context/nunjucks/use-nunjucks';
import { RequestLoaderData } from '../../routes/request';

export const ResponseVisualizeViewer = () => {
    const { handleRender } = useNunjucks();
    const { activeRequestMeta } = useRouteLoaderData('request/:requestId') as RequestLoaderData;
    const [resBody, setResBody] = useState('about:blank');
    const encodeBody = (body: string) =>

        'data:text/html;charset=UTF-8,' + encodeURIComponent(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Response visualizer</title>
            <meta charset="UTF-8">
          </head>
          <body>
            ${body}
          </body>
        </html>`);

    useEffect(() => {
        const loadFunc = async () => {
            let tempBody = 'about:blank';
            if (activeRequestMeta) {
                const { visualizeTemplate } = activeRequestMeta;
                try {
                    tempBody = await handleRender(visualizeTemplate || '');
                } catch (err) {
                    tempBody = `<h4 style="color:red;">${err.message}</h4>`;
                }
            }
            setResBody(encodeBody(tempBody));
        };
        loadFunc();
    }, [activeRequestMeta, handleRender]);

    return (
        // eslint-disable-next-line react/no-unknown-property
        <webview src={resBody} webpreferences={'javascript=no'} />
    );
};
