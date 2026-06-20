import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { apiUsers, type Contador, type User } from "@/lib/api";

interface LocalUser {
  id: string;
  email: string;
  name: string;
  crc?: string;
  phone?: string;
}

interface AuthCtx {
  user: LocalUser | null;
  remoteUser: User | null;
  contador: Contador | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<Pick<LocalUser, "name" | "email" | "crc" | "phone">>) => void;
  refreshMe: () => Promise<void>;
  /** Nome a exibir em relatórios — preferindo o contador vinculado ao usuário. */
  displayName: () => string;
  /** CRC a exibir em relatórios — preferindo o contador vinculado ao usuário. */
  displayCrc: () => string;
}

// Mantido para compatibilidade com SidebarContext e outros consumidores
const STORAGE_KEY = "econ_local_user";

const Ctx = createContext<AuthCtx>({
  user: null,
  remoteUser: null,
  contador: null,
  loading: true,
  signIn: async () => {},
  signUp: async () => {},
  signOut: async () => {},
  updateProfile: () => {},
  refreshMe: async () => {},
  displayName: () => "",
  displayCrc: () => "",
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<LocalUser | null>(null);
  const [remoteUser, setRemoteUser] = useState<User | null>(null);
  const [contador, setContador] = useState<Contador | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async (email: string) => {
    try {
      const me = await apiUsers.me(email);
      setRemoteUser(me.user);
      setContador(me.contador);
    } catch {
      // Profile ainda não existe ou sem registro em contadores — modo degradado.
      setRemoteUser(null);
      setContador(null);
    }
  }, []);

  // Ouvir mudanças de sessão do Supabase Auth
  useEffect(() => {
    // Verificar sessão existente
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const su = session.user;
        const localUser: LocalUser = {
          id: su.id,
          email: su.email ?? "",
          name:
            (su.user_metadata?.full_name as string | undefined) ??
            su.email ??
            "",
        };
        setUser(localUser);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(localUser));
        if (su.email) void fetchMe(su.email);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          const su = session.user;
          const localUser: LocalUser = {
            id: su.id,
            email: su.email ?? "",
            name:
              (su.user_metadata?.full_name as string | undefined) ??
              su.email ??
              "",
          };
          setUser(localUser);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(localUser));
          if (su.email) void fetchMe(su.email);
        } else {
          setUser(null);
          setRemoteUser(null);
          setContador(null);
          localStorage.removeItem(STORAGE_KEY);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchMe]);

  const signIn = async (email: string, password: string): Promise<void> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  };

  const signUp = async (
    name: string,
    email: string,
    password: string
  ): Promise<void> => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });
    if (error) throw new Error(error.message);
  };

  const signOut = async (): Promise<void> => {
    await supabase.auth.signOut();
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
    setRemoteUser(null);
    setContador(null);
  };

  const updateProfile = (
    data: Partial<Pick<LocalUser, "name" | "email" | "crc" | "phone">>
  ) => {
    if (!user) return;
    const updated: LocalUser = { ...user, ...data };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setUser(updated);
  };

  const refreshMe = useCallback(async () => {
    if (user?.email) await fetchMe(user.email);
  }, [user, fetchMe]);

  const displayName = () =>
    contador?.name?.trim() || user?.name?.trim() || user?.email?.trim() || "";
  const displayCrc = () => contador?.crc?.trim() || user?.crc?.trim() || "";

  return (
    <Ctx.Provider
      value={{
        user,
        remoteUser,
        contador,
        loading,
        signIn,
        signUp,
        signOut,
        updateProfile,
        refreshMe,
        displayName,
        displayCrc,
      }}
    >
      {children}
    </Ctx.Provider>
  );
};

export const useAuth = () => useContext(Ctx);
