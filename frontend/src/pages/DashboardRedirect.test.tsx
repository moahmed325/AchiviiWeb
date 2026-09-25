import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { DashboardRedirect } from '../App';

const LocationDisplay = () => {
  const location = useLocation();
  return (
    <div>
      <span data-testid="pathname">{location.pathname}</span>
      <span data-testid="search">{location.search}</span>
      <span data-testid="hash">{location.hash}</span>
    </div>
  );
};

describe('DashboardRedirect (OD-3)', () => {
  it('redirects /dashboard to / without query or hash', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<DashboardRedirect />} />
          <Route path="/" element={<LocationDisplay />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('pathname')).toHaveTextContent('/');
    expect(screen.getByTestId('search')).toHaveTextContent('');
    expect(screen.getByTestId('hash')).toHaveTextContent('');
  });

  it('redirects /dashboard to / strictly preserving search query and hash fragment', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard?tab=overview&week=2#focus-section']}>
        <Routes>
          <Route path="/dashboard" element={<DashboardRedirect />} />
          <Route path="/" element={<LocationDisplay />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('pathname')).toHaveTextContent('/');
    expect(screen.getByTestId('search')).toHaveTextContent('?tab=overview&week=2');
    expect(screen.getByTestId('hash')).toHaveTextContent('#focus-section');
  });
});
