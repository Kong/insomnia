import React from 'react';
import Header from './header';
import Breadcrumb from './breadcrumb';
import Switch from './switch';
import Button from './button';

export default { title: 'Layout | Header' };

export const _default = () => <Header />;

export const _withElements = () =>
    <Header
        gridLeft={(
            <React.Fragment>
                <Breadcrumb className="breadcrumb" crumbs={['Documents', 'Deployment']} />
            </React.Fragment>
        )}
        gridCenter={(
                <Switch optionItems={[{ label: 'DESIGN', selected: true }, { label: 'DEBUG', selected: false }]} />
        )}
        gridRight={(
            <React.Fragment>
                <Button variant="contained">
                    Some Button
                </Button>
            </React.Fragment>
        )}
    />;
