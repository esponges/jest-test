import { jest } from '@jest/globals';
import {render, screen} from '@testing-library/react'
import App from './App';

describe('App', () => {
  it('works', () => {
    const {container} = render(<App />);
    screen.debug();
    expect(container).toBeDefined();
  })
});
