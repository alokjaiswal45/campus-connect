
import { Injectable } from '@angular/core';

import {
  HttpClient,
  HttpHeaders,
  HttpParams
} from '@angular/common/http';

import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  // Spring Boot backend address
  // In production, serve the API behind the same origin under /api.
  // During local Angular development, use the Spring Boot server on port 8080.
  readonly base = ['localhost', '127.0.0.1'].includes(window.location.hostname)
    ? 'http://localhost:8080/api'
    : window.location.origin + '/api';

  constructor(
    private http: HttpClient
  ) {}

  // =====================================
  // AUTHENTICATION HEADERS
  // =====================================

  private getHeaders(): HttpHeaders {

    const savedAuth = sessionStorage.getItem('cc_auth');

    if (savedAuth) {
      return new HttpHeaders({
        Authorization: 'Basic ' + savedAuth
      });
    }

    return new HttpHeaders();
  }

  // =====================================
  // PUBLIC AUTH ENDPOINTS
  // =====================================

  private isPublicEndpoint(path: string): boolean {

    return [
      '/auth/register',
      '/auth/send-otp',
      '/auth/verify-otp',
    '/auth/password-reset/request',
    '/auth/password-reset/confirm'
    ].includes(path.split('?')[0]);
  }

  private headersFor(path: string): HttpHeaders {

    if (this.isPublicEndpoint(path)) {
      return new HttpHeaders();
    }

    return this.getHeaders();
  }

  // =====================================
  // GET REQUEST
  // =====================================

  get(
    path: string,
    params?: HttpParams | Record<string, any>
  ): Observable<any> {

    return this.http.get<any>(
      this.base + path,
      {
        headers: this.headersFor(path),
        params
      }
    );
  }

  // =====================================
  // POST REQUEST
  // =====================================

  post(
    path: string,
    body: any
  ): Observable<any> {

    return this.http.post<any>(
      this.base + path,
      body,
      {
        headers: this.headersFor(path)
      }
    );
  }

  // =====================================
  // PUT REQUEST
  // =====================================

  put(
    path: string,
    body: any
  ): Observable<any> {

    return this.http.put<any>(
      this.base + path,
      body,
      {
        headers: this.getHeaders()
      }
    );
  }

  // =====================================
  // DELETE REQUEST
  // =====================================

  delete(path: string): Observable<any> {

    return this.http.delete<any>(
      this.base + path,
      {
        headers: this.getHeaders()
      }
    );
  }

  uploadDocument(form: FormData): Observable<any> {
    return this.http.post<any>(this.base + '/documents', form, { headers: this.getHeaders() });
  }

  uploadImage(path: string, file: File): Observable<any> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<any>(this.base + path, form, { headers: this.getHeaders() });
  }

  getImage(id: number): Observable<Blob> {
    return this.http.get(this.base + '/images/' + id, {
      headers: this.getHeaders(), responseType: 'blob'
    });
  }

  // =====================================
  // PDF FILE URL
  // =====================================

  fileUrl(id: number): string {

    return this.base + '/documents/' + id + '/file';
  }

  // =====================================
  // AUTHENTICATED PDF DOWNLOAD
  // =====================================

  getPdf(id: number): Observable<Blob> {

    return this.http.get(
      this.fileUrl(id),
      {
        headers: this.getHeaders(),
        responseType: 'blob'
      }
    );
  }

}
