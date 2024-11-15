import axios, { AxiosError } from 'axios';
import { useForm, SubmitHandler } from 'react-hook-form';
import { Stack } from '@mui/material';

type FormValues = {
  username: string;
  password: string;
}

type LoginProps = {
  onLogin: (username: string) => void,
  onMessage: (message: string) => void
};


export default function CraftLogin({onLogin, onMessage}: LoginProps) {
  const { register, handleSubmit, reset } = useForm<FormValues>();
  const onSubmit: SubmitHandler<FormValues> = async (data) => {
      const response = await axios.post(location.href, {
        username: data.username,
        passcode: data.password
      }).catch((error: AxiosError) => {
        onMessage(`${error.message}`);
      });

      localStorage.setItem('username', data.username)

      reset({
        username: "",
        password: ""
      });

      onLogin(data.username);
    }

  return (
    <>
      <h1>Login</h1>
      <form onSubmit={handleSubmit(onSubmit)}>
        <Stack spacing={2}>
          <input {...register("username")} className='form-control' placeholder='Username'/>
          <input type={"password"} {...register("password")} className='form-control' placeholder='Password'/>
          <input type="submit" value={"Login"} className="btn btn-primary shadow d-block w-100"/>
        </Stack>

      </form>
    </>
  )
}