import 'swagger-ui-dist/swagger-ui.css';

import React, { FC, useEffect, useRef } from 'react';
import { SwaggerConfigs, SwaggerUIBundle as createSwaggerUI } from 'swagger-ui-dist';

export const SwaggerUI: FC<SwaggerConfigs> = props => {
  const swaggerUIRef = useRef<SwaggerConfigs | null>(null);
  const domNodeRef = useRef(null);

  useEffect(() => {
    swaggerUIRef.current = createSwaggerUI({
      ...props,
      domNode: domNodeRef.current,
    });
  }, [props]);

  useEffect(() => {
    const swaggerUI = swaggerUIRef?.current;

    if (swaggerUI) {
      const prevStateUrl = swaggerUIRef?.current?.specSelectors.url();
      if (props.url !== prevStateUrl) {
        // flush current content
        swaggerUI.specActions.updateSpec('');

        if (props.url) {
          // update the internal URL
          swaggerUI.specActions.updateUrl(props.url);
          // trigger remote definition fetch
          swaggerUI.system.specActions.download(props.url);
        }
      }

      const prevStateSpec = swaggerUI.specSelectors.specStr();
      if (props.spec && (props.spec !== prevStateSpec)) {
        if (typeof props.spec === 'object') {
          swaggerUI.specActions.updateSpec(JSON.stringify(props.spec));
        } else {
          swaggerUI.specActions.updateSpec(props.spec);
        }
      }
    }
  }, [props.spec, props.url]);

  return <div ref={domNodeRef} />;
};
