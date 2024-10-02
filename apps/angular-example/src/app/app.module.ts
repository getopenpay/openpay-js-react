import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppComponent } from './app.component';
import { OpenPayFormComponent } from './open-pay-form/open-pay-form.component';

@NgModule({
  declarations: [AppComponent, OpenPayFormComponent],
  imports: [BrowserModule],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
