import {
  Brand,
  Masthead,
  MastheadBrand,
  MastheadContent,
  MastheadLogo,
  MastheadMain,
  MastheadToggle,
  PageToggleButton,
  ToggleGroup,
  ToggleGroupItem,
  Toolbar,
  ToolbarContent,
  ToolbarItem
} from '@patternfly/react-core';

import React from 'react';

import { StandaloneTheme } from './standalone-theme';

export const Header: React.FunctionComponent<{
  isSidebarOpen: boolean;
  onSidebarToggle: () => void;
  theme: StandaloneTheme;
  setTheme: (theme: StandaloneTheme) => void;
}> = ({ isSidebarOpen, onSidebarToggle, theme, setTheme }) => {
  return (
    <Masthead>
      <MastheadMain>
        <MastheadToggle>
          <PageToggleButton
            isHamburgerButton
            variant="plain"
            aria-label="Global navigation"
            isSidebarOpen={isSidebarOpen}
            onSidebarToggle={onSidebarToggle}
            id="nav-toggle"
          ></PageToggleButton>
        </MastheadToggle>
        <MastheadBrand data-codemods>
          <MastheadLogo data-codemods>
            <Brand src={'/assets/netobserv.svg'} widths={{ default: '40px' }} alt="NetObserv Logo" />
          </MastheadLogo>
        </MastheadBrand>
      </MastheadMain>
      <MastheadContent>
        <Toolbar id="vertical-toolbar">
          <ToolbarContent>
            <ToolbarItem className="masthead-link">
              <a href="https://netobserv.io" title="Open netobserv.io" target="_blank" rel="noreferrer">
                NetObserv.io
              </a>
            </ToolbarItem>
            <ToolbarItem align={{ default: 'alignEnd' }}>
              <ToggleGroup aria-label="Color theme" isCompact>
                <ToggleGroupItem text="Light" isSelected={theme === 'light'} onClick={() => setTheme('light')} />
                <ToggleGroupItem text="Dark" isSelected={theme === 'dark'} onClick={() => setTheme('dark')} />
                <ToggleGroupItem text="Glass" isSelected={theme === 'glass'} onClick={() => setTheme('glass')} />
                <ToggleGroupItem
                  text="Contrast"
                  aria-label="High contrast"
                  isSelected={theme === 'high-contrast'}
                  onClick={() => setTheme('high-contrast')}
                />
              </ToggleGroup>
            </ToolbarItem>
          </ToolbarContent>
        </Toolbar>
      </MastheadContent>
    </Masthead>
  );
};

export default Header;
