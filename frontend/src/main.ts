import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { RouterRootComponent } from './app/router-root.component';
import { routes } from './app/portal-routing';
import { authInterceptor } from './app/auth.interceptor';

bootstrapApplication(RouterRootComponent, {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor]))
  ]
}).catch(console.error);
