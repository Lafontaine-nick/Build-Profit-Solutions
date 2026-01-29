import React from 'react';
import { render } from '@testing-library/react-native';
import PageHeader from '../../components/PageHeader';

// Mock the theme context
jest.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({
    darkMode: false,
    toggleTheme: jest.fn(),
  }),
}));

describe('PageHeader', () => {
  it('renders correctly with title', () => {
    const { getByText } = render(<PageHeader title='Test Title' />);

    expect(getByText('Test Title')).toBeTruthy();
  });

  it('renders with subtitle when provided', () => {
    const { getByText } = render(
      <PageHeader title='Test Title' subtitle='Test Subtitle' />
    );

    expect(getByText('Test Title')).toBeTruthy();
    expect(getByText('Test Subtitle')).toBeTruthy();
  });

  it('renders without subtitle when not provided', () => {
    const { queryByText } = render(<PageHeader title='Test Title' />);

    expect(queryByText('Test Subtitle')).toBeNull();
  });
});
