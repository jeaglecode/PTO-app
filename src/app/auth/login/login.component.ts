import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  mode: 'login' | 'register' = 'login';
  loading = false;
  errorMsg = '';

  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });


  async submit() {
    this.errorMsg = '';
    if (this.form.invalid) return;
    const { email, password } = this.form.value as { email: string; password: string };
    this.loading = true;
    try {
      if (this.mode === 'login') {
        await this.auth.login(email, password);
      } else {
        await this.auth.register(email, password);
      }
      await this.router.navigate(['/planner']);
    } catch (err: any) {
      this.errorMsg = err?.message || 'Authentication failed';
    } finally {
      this.loading = false;
    }
  }
}
