"""
CALCULUS III formulas
"""

CLASS_NAME = "CALCULUS III"

FORMULAS = {
    "Vector Formulas": [
        {"name": "Dot Product", "latex": r"\mathbf{u}\cdot\mathbf{v}=|\mathbf{u}||\mathbf{v}|\cos\theta=u_1v_1+u_2v_2+u_3v_3"},
        {"name": "Cross Product", "latex": r"\mathbf{u}\times\mathbf{v}=\begin{vmatrix}\mathbf{i}&\mathbf{j}&\mathbf{k}\\u_1&u_2&u_3\\v_1&v_2&v_3\end{vmatrix},\ |\mathbf{u}\times\mathbf{v}|=|\mathbf{u}||\mathbf{v}|\sin\theta"},
        {"name": "Projection", "latex": r"\text{proj}_{\mathbf{v}}\mathbf{u}=\frac{\mathbf{u}\cdot\mathbf{v}}{|\mathbf{v}|^2}\mathbf{v}"},
        {"name": "Component", "latex": r"\text{comp}_{\mathbf{v}}\mathbf{u}=\frac{\mathbf{u}\cdot\mathbf{v}}{|\mathbf{v}|}"},
        {"name": "Line Equation", "latex": r"\mathbf{r}(t)=\mathbf{r}_0+t\mathbf{d}"},
        {"name": "Plane Equation", "latex": r"a(x-x_0)+b(y-y_0)+c(z-z_0)=0"},
        {"name": "Divergence", "latex": r"\nabla\cdot\mathbf{F}=\frac{\partial P}{\partial x}+\frac{\partial Q}{\partial y}+\frac{\partial R}{\partial z}"},
        {"name": "Curl", "latex": r"\nabla\times\mathbf{F}=\begin{vmatrix}\mathbf{i}&\mathbf{j}&\mathbf{k}\\\partial_x&\partial_y&\partial_z\\P&Q&R\end{vmatrix}"},
        {"name": "Line Integral", "latex": r"\int_C\mathbf{F}\cdot d\mathbf{r}=\int_a^b\mathbf{F}(\mathbf{r}(t))\cdot\mathbf{r}'(t)\,dt"},
        {"name": "Fundamental Theorem for Line Integrals", "latex": r"\int_C\mathbf{F}\cdot d\mathbf{r}=f(B)-f(A)\text{ if }\mathbf{F}=\nabla f"},
        {"name": "Green's Theorem", "latex": r"\oint_C\mathbf{F}\cdot d\mathbf{r}=\iint_D\!\left(\frac{\partial Q}{\partial x}-\frac{\partial P}{\partial y}\right)dA"},
        {"name": "Divergence Theorem", "latex": r"\iint_S\mathbf{F}\cdot d\mathbf{S}=\iiint_E(\nabla\cdot\mathbf{F})\,dV"},
        {"name": "Stokes' Theorem", "latex": r"\oint_C\mathbf{F}\cdot d\mathbf{r}=\iint_S(\nabla\times\mathbf{F})\cdot d\mathbf{S}"},
    ],
    "Partial Derivatives and Optimization": [
        {"name": "Definition", "latex": r"\frac{\partial f}{\partial x}=f_x=\lim_{h\to0}\frac{f(x+h,y)-f(x,y)}{h}"},
        {"name": "Total Differential", "latex": r"dz=f_x\,dx+f_y\,dy"},
        {"name": "Chain Rule", "latex": r"\frac{dz}{dt}=\frac{\partial z}{\partial x}\frac{dx}{dt}+\frac{\partial z}{\partial y}\frac{dy}{dt}"},
        {"name": "Directional Derivative", "latex": r"D_{\mathbf{u}}f=\nabla f\cdot\hat{\mathbf{u}}=f_xu_1+f_yu_2+f_zu_3"},
        {"name": "Gradient", "latex": r"\nabla f=\langle f_x,f_y,f_z\rangle,\ |\nabla f|\text{ gives max rate of change}"},
        {"name": "Second Derivative Test", "latex": r"D=f_{xx}f_{yy}-(f_{xy})^2"},
        {"name": "Local Extremes", "latex": r"D>0,f_{xx}>0\Rightarrow\text{local min};\ D>0,f_{xx}<0\Rightarrow\text{local max};\ D<0\Rightarrow\text{saddle}"},
        {"name": "Lagrange Multipliers", "latex": r"\nabla f=\lambda\nabla g"},
    ],
    "Multiple Integrals": [
        {"name": "Fubini's Theorem", "latex": r"\iint_R f\,dA=\int_a^b\int_c^d f(x,y)\,dy\,dx"},
        {"name": "Polar Coordinates", "latex": r"\iint_R f\,dA=\int_\alpha^\beta\int_{g_1}^{g_2}f(r\cos\theta,r\sin\theta)\,r\,dr\,d\theta"},
        {"name": "Cylindrical Coordinates", "latex": r"dV=r\,dz\,dr\,d\theta"},
        {"name": "Spherical Coordinates", "latex": r"x=\rho\sin\phi\cos\theta,\ y=\rho\sin\phi\sin\theta,\ z=\rho\cos\phi"},
        {"name": "Spherical Volume Element", "latex": r"dV=\rho^2\sin\phi\,d\rho\,d\phi\,d\theta"},
        {"name": "Jacobian", "latex": r"\iint_R f\,dA=\iint_S f(x(u,v),y(u,v))\left|\frac{\partial(x,y)}{\partial(u,v)}\right|du\,dv"},
    ],
}
