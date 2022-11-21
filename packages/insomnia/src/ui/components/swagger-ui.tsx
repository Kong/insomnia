import 'swagger-ui-dist/swagger-ui.css';

import React, { FC, useEffect, useRef } from 'react';
import { Spec, SwaggerConfigs, SwaggerUIBundle as createSwaggerUI } from 'swagger-ui-dist';

// Keep an instance of swagger-ui because it doesn't have a teardown method
let SwaggerUIInstance: SwaggerConfigs | null = null;

export const SwaggerUI: FC<{
  spec: Spec;
  supportedSubmitMethods: string[];
}> = ({
  spec,
  supportedSubmitMethods,
}) => {
  const domNodeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const swaggerUI = SwaggerUIInstance;

    if (swaggerUI) {
      const prevStateSpec = swaggerUI.specSelectors.specStr();
      if (spec && (spec !== prevStateSpec)) {
        if (typeof spec === 'object') {
          swaggerUI.specActions.updateSpec(JSON.stringify(spec));
        } else {
          swaggerUI.specActions.updateSpec(spec);
        }
      }
    } else {
      SwaggerUIInstance = createSwaggerUI({
        domNode: domNodeRef.current,
        spec,
        supportedSubmitMethods,
      });
    }
  }, [supportedSubmitMethods, spec]);

  return <div ref={domNodeRef} />;
};
