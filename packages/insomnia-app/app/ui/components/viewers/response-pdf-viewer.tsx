import { autoBindMethodsForReact } from 'class-autobind-decorator';
import * as PDF from 'pdfjs-dist/webpack';
import React, { CSSProperties, PureComponent } from 'react';

import { AUTOBIND_CFG } from '../../../common/constants';

interface Props {
  body: Buffer;
  uniqueKey: string;
}

interface State {
  numPages: number | null;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class ResponsePDFViewer extends PureComponent<Props, State> {
  container: HTMLDivElement | null = null;
  debounceTimeout: NodeJS.Timeout | null = null;

  setRef(n: HTMLDivElement) {
    this.container = n;
  }

  loadPDF() {
    if (this.debounceTimeout !== null) {
      clearTimeout(this.debounceTimeout);
    }
    this.debounceTimeout = setTimeout(async () => {
      // get node for this react component
      const container = this.container;

      if (!container) {
        return;
      }

      container.innerHTML = '';
      const containerWidth = container.clientWidth;
      const pdf = await PDF.getDocument({
        data: this.props.body.toString('binary'),
      }).promise;

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const density = window.devicePixelRatio || 1;
        const { width: pdfWidth, height: pdfHeight } = page.getViewport({
          scale: 1,
        });
        const ratio = pdfHeight / pdfWidth;
        const scale = containerWidth / pdfWidth;
        const viewport = page.getViewport({
          scale: scale * density,
        });
        // set canvas for page
        const canvas = document.createElement('canvas');
        canvas.width = containerWidth * density;
        // canvas.height = containerWidth * (viewport.height / viewport.width);
        canvas.height = containerWidth * ratio * density;
        canvas.style.width = `${containerWidth}px`;
        canvas.style.height = `${containerWidth * ratio}px`;
        container.appendChild(canvas);
        // get context and render page
        const context = canvas.getContext('2d');
        const renderContext = {
          id: `${this.props.uniqueKey}.${i}`,
          canvasContext: context,
          viewport: viewport,
        };
        await page.render(renderContext).promise;
      }
    }, 100);
  }

  handleResize() {
    if (!this.container) {
      return;
    }

    if (this.debounceTimeout !== null) {
      clearTimeout(this.debounceTimeout);
    }
    this.debounceTimeout = setTimeout(this.loadPDF, 300);
  }

  componentDidUpdate() {
    this.loadPDF();
  }

  componentDidMount() {
    this.loadPDF();
    window.addEventListener('resize', this.handleResize);
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.handleResize);
  }

  render() {
    const styles: CSSProperties = {
      width: '100%',
      height: '100%',
      overflowX: 'hidden',
      overflowY: 'scroll',
      padding: '0px',
    };
    return (
      <div className="S-PDF-ID" ref={this.setRef} style={styles}>
        <div className="faded text-center vertically-center tall">Loading PDF...</div>
      </div>
    );
  }
}
