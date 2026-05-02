import { fireEvent, render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import AuthContext from '../context/AuthContext';
import SignUp from './SignUp';

const renderWithContext = (component, authContextValue = {}) => {
  return render(
    <AuthContext.Provider value={authContextValue}>
      <BrowserRouter>
        {component}
      </BrowserRouter>
    </AuthContext.Provider>
  );
};

describe('SignUp Component', () => {
  it('renders sign up form properly', () => {
    renderWithContext(<SignUp />, { registerUser: vi.fn() });
    
    expect(screen.getByRole('heading', { name: /create an account/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument();
  });

  it('calls registerUser with username and password when submitted', () => {
    const mockRegisterUser = vi.fn();
    renderWithContext(<SignUp />, { registerUser: mockRegisterUser });

    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign up/i });

    fireEvent.change(usernameInput, { target: { value: 'newuser123' } });
    fireEvent.change(passwordInput, { target: { value: 'securepassword!' } });
    fireEvent.click(submitButton);

    expect(mockRegisterUser).toHaveBeenCalledTimes(1);
    expect(mockRegisterUser).toHaveBeenCalledWith('newuser123', 'securepassword!');
  });
});
