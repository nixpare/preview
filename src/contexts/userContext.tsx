import { createContext } from "react";

type UserContextType = {
    user: string;
};

const ThemeContext = createContext<UserContextType>({user: ""});

export default ThemeContext;