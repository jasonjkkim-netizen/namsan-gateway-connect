import { render,screen } from '@testing-library/react';
import { MemoryRouter,Route,Routes } from 'react-router-dom';
import { describe,it,expect,vi,beforeEach } from 'vitest';
import { WebmasterRoute } from './WebmasterRoute';
let auth:{loading:boolean;user:unknown;profile:{sales_role:string}|null;isAdmin:boolean};
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>auth}));
vi.mock('@/contexts/LanguageContext',()=>({useLanguage:()=>({language:'en'})}));
function gate(){return render(<MemoryRouter initialEntries={['/finance']}><Routes><Route path="/finance" element={<WebmasterRoute><p>Finance content</p></WebmasterRoute>}/><Route path="/login" element={<p>Login destination</p>}/></Routes></MemoryRouter>);}
beforeEach(()=>{auth={loading:false,user:{id:'test'},profile:{sales_role:'webmaster'},isAdmin:false};});
describe('WebmasterRoute',()=>{
 it('waits during loading',()=>{auth.loading=true;gate();expect(screen.getByRole('status')).toBeInTheDocument();expect(screen.queryByText('Finance content')).toBeNull();});
 it('redirects visitors to login',()=>{auth.user=null;gate();expect(screen.getByText('Login destination')).toBeInTheDocument();});
 it('denies admin alone and provides dashboard return',()=>{auth.isAdmin=true;auth.profile={sales_role:'client'};gate();expect(screen.queryByText('Finance content')).toBeNull();expect(screen.getByRole('link')).toHaveAttribute('href','/dashboard');});
 it('allows only signed-in webmaster',()=>{gate();expect(screen.getByText('Finance content')).toBeInTheDocument();});
});
