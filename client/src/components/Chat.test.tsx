
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Chat from './Chat';

// Mock Socket.IO client
const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
};

describe('Chat Component', () => {
  it('renders chat title and message count badge', () => {
    // Render the component with mock props
    render(<Chat socket={mockSocket} room="test-room" username="test-user" />);

    // Check if the title "Sohbet" is in the document
    const titleElement = screen.getByText('Sohbet');
    expect(titleElement).toBeInTheDocument();

    // Check if the message count badge is rendered
    const badgeElement = screen.getByText(/Mesaj/);
    expect(badgeElement).toBeInTheDocument();
  });

  it('renders an input field to type a message', () => {
    render(<Chat socket={mockSocket} room="test-room" username="test-user" />);

    // Check for the placeholder text in the input
    const inputElement = screen.getByPlaceholderText('Mesaj yaz...');
    expect(inputElement).toBeInTheDocument();
  });
});
