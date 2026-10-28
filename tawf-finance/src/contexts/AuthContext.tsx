import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { UserRole, User } from '@/data/mockData';
import { demoUsers } from '@/data/mockData';
import { ROLE_HOME } from '@/contexts/roleHome';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string) => Promise<void>;
  loginAsDemo: (role: UserRole) => Promise<void>;
  register: (name: string, email: string, role: UserRole) => void;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  // Check for existing session on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('tawf_user');
    if (storedUser) {
      try {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate persisted session on mount
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem('tawf_user');
      }
    }
    setIsLoading(false);
  }, []);

  // Save user to localStorage whenever it changes
  useEffect(() => {
    if (user) {
      localStorage.setItem('tawf_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('tawf_user');
    }
  }, [user]);

  const login = async (email: string) => {
    setIsLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 800));

    // Mock login - accepts any password for demo purposes
    // In production, this would validate against a real backend
    if (email.toLowerCase().includes('investor')) {
      setUser(demoUsers.investor);
    } else if (email.toLowerCase().includes('issuer') || email.toLowerCase().includes('sekuritas')) {
      setUser(demoUsers.issuer);
    } else if (email.toLowerCase().includes('admin')) {
      setUser(demoUsers.admin);
    } else {
      // Default to investor for demo
      setUser(demoUsers.investor);
    }

    setIsLoading(false);
  };

  const loginAsDemo = async (role: UserRole) => {
    setIsLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));
    setUser(demoUsers[role]);
    setIsLoading(false);
  };

  /** Demo registration: a local profile on top of the demo user of that role. No backend. */
  const register = (name: string, email: string, role: UserRole) => {
    const base = demoUsers[role];
    setUser({
      ...base,
      id: `user-${Date.now()}`,
      name: name.trim() || base.name,
      email: email.trim() || base.email,
      status: 'active',
      joinedAt: new Date().toISOString(),
      tier: undefined,
      kycVerified: false,
      walletAddress: undefined,
      phoneNumber: undefined,
    });
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('tawf_user');
    navigate('/login');
  };

  const updateUser = (updates: Partial<User>) => {
    if (user) {
      setUser({ ...user, ...updates });
    }
  };

  // Redirect based on role
  useEffect(() => {
    if (!isLoading && user && location.pathname === '/login') {
      navigate(ROLE_HOME[user.role], { replace: true });
    }
  }, [user, isLoading, location.pathname, navigate]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        loginAsDemo,
        register,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- hook co-located with its provider
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
