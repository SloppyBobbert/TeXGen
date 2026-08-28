"""
CALCULUS III formulas
"""

CLASS_NAME = "CALCULUS III"

FORMULAS = {
    "Vector Formulas": [
        { "id": "calculus-iii.dot-product","name": "Dot Product", "latex": r"\mathbf{u}\cdot\mathbf{v}=|\mathbf{u}||\mathbf{v}|\cos\theta=u_1v_1+u_2v_2+u_3v_3"},
        { "id": "calculus-iii.cross-product","name": "Cross Product", "latex": r"\mathbf{u}\times\mathbf{v}=\begin{vmatrix}\mathbf{i}&\mathbf{j}&\mathbf{k}\\u_1&u_2&u_3\\v_1&v_2&v_3\end{vmatrix},\ |\mathbf{u}\times\mathbf{v}|=|\mathbf{u}||\mathbf{v}|\sin\theta"},
        { "id": "calculus-iii.projection","name": "Projection", "latex": r"\text{proj}_{\mathbf{v}}\mathbf{u}=\frac{\mathbf{u}\cdot\mathbf{v}}{|\mathbf{v}|^2}\mathbf{v}"},
        { "id": "calculus-iii.component","name": "Component", "latex": r"\text{comp}_{\mathbf{v}}\mathbf{u}=\frac{\mathbf{u}\cdot\mathbf{v}}{|\mathbf{v}|}"},
        { "id": "calculus-iii.line-equation","name": "Line Equation", "latex": r"\mathbf{r}(t)=\mathbf{r}_0+t\mathbf{d}"},
        { "id": "calculus-iii.plane-equation","name": "Plane Equation", "latex": r"a(x-x_0)+b(y-y_0)+c(z-z_0)=0"},
        { "id": "calculus-iii.divergence","name": "Divergence", "latex": r"\nabla\cdot\mathbf{F}=\frac{\partial P}{\partial x}+\frac{\partial Q}{\partial y}+\frac{\partial R}{\partial z}"},
        { "id": "calculus-iii.curl","name": "Curl", "latex": r"\nabla\times\mathbf{F}=\begin{vmatrix}\mathbf{i}&\mathbf{j}&\mathbf{k}\\\partial_x&\partial_y&\partial_z\\P&Q&R\end{vmatrix}"},
        { "id": "calculus-iii.line-integral","name": "Line Integral", "latex": r"\int_C\mathbf{F}\cdot d\mathbf{r}=\int_a^b\mathbf{F}(\mathbf{r}(t))\cdot\mathbf{r}'(t)\,dt"},
        { "id": "calculus-iii.fundamental-theorem-for-line-integrals","name": "Fundamental Theorem for Line Integrals", "latex": r"\int_C\mathbf{F}\cdot d\mathbf{r}=f(B)-f(A)\text{ if }\mathbf{F}=\nabla f"},
        { "id": "calculus-iii.green-s-theorem","name": "Green's Theorem", "latex": r"\oint_C\mathbf{F}\cdot d\mathbf{r}=\iint_D\!\left(\frac{\partial Q}{\partial x}-\frac{\partial P}{\partial y}\right)dA"},
        { "id": "calculus-iii.divergence-theorem","name": "Divergence Theorem", "latex": r"\iint_S\mathbf{F}\cdot d\mathbf{S}=\iiint_E(\nabla\cdot\mathbf{F})\,dV"},
        { "id": "calculus-iii.stokes-theorem","name": "Stokes' Theorem", "latex": r"\oint_C\mathbf{F}\cdot d\mathbf{r}=\iint_S(\nabla\times\mathbf{F})\cdot d\mathbf{S}"},
    ],
    "Partial Derivatives and Optimization": [
        { "id": "calculus-iii.definition","name": "Definition", "latex": r"\frac{\partial f}{\partial x}=f_x=\lim_{h\to0}\frac{f(x+h,y)-f(x,y)}{h}"},
        { "id": "calculus-iii.total-differential","name": "Total Differential", "latex": r"dz=f_x\,dx+f_y\,dy"},
        { "id": "calculus-iii.chain-rule","name": "Chain Rule", "latex": r"\frac{dz}{dt}=\frac{\partial z}{\partial x}\frac{dx}{dt}+\frac{\partial z}{\partial y}\frac{dy}{dt}"},
        { "id": "calculus-iii.directional-derivative","name": "Directional Derivative", "latex": r"D_{\mathbf{u}}f=\nabla f\cdot\hat{\mathbf{u}}=f_xu_1+f_yu_2+f_zu_3"},
        { "id": "calculus-iii.gradient","name": "Gradient", "latex": r"\nabla f=\langle f_x,f_y,f_z\rangle,\ |\nabla f|\text{ gives max rate of change}"},
        { "id": "calculus-iii.second-derivative-test","name": "Second Derivative Test", "latex": r"D=f_{xx}f_{yy}-(f_{xy})^2"},
        { "id": "calculus-iii.local-extremes","name": "Local Extremes", "latex": r"D>0,f_{xx}>0\Rightarrow\text{local min};\ D>0,f_{xx}<0\Rightarrow\text{local max};\ D<0\Rightarrow\text{saddle}"},
        { "id": "calculus-iii.lagrange-multipliers","name": "Lagrange Multipliers", "latex": r"\nabla f=\lambda\nabla g"},
    ],
    "Multiple Integrals": [
        { "id": "calculus-iii.fubini-s-theorem","name": "Fubini's Theorem", "latex": r"\iint_R f\,dA=\int_a^b\int_c^d f(x,y)\,dy\,dx"},
        { "id": "calculus-iii.polar-coordinates","name": "Polar Coordinates", "latex": r"\iint_R f\,dA=\int_\alpha^\beta\int_{g_1}^{g_2}f(r\cos\theta,r\sin\theta)\,r\,dr\,d\theta"},
        { "id": "calculus-iii.cylindrical-coordinates","name": "Cylindrical Coordinates", "latex": r"dV=r\,dz\,dr\,d\theta"},
        { "id": "calculus-iii.spherical-coordinates","name": "Spherical Coordinates", "latex": r"x=\rho\sin\phi\cos\theta,\ y=\rho\sin\phi\sin\theta,\ z=\rho\cos\phi"},
        { "id": "calculus-iii.spherical-volume-element","name": "Spherical Volume Element", "latex": r"dV=\rho^2\sin\phi\,d\rho\,d\phi\,d\theta"},
        { "id": "calculus-iii.jacobian","name": "Jacobian", "latex": r"\iint_R f\,dA=\iint_S f(x(u,v),y(u,v))\left|\frac{\partial(x,y)}{\partial(u,v)}\right|du\,dv"},
    ],
}
