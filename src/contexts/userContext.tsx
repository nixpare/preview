import { createContext } from "react";
import { User } from "../models/User";
import { ServersInfo } from "../models/Server";

export type UserContextType = {
    user?: User
    servers?: ServersInfo
};

const UserContext = createContext<UserContextType>({});
export default UserContext
