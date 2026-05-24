# `entity` decoration and modeling

The `entity` decorator module defines rules about a class, collected into a **`@Model`**, through annotating properties with **`@Property`**.

**This module does not modify class behavior**. It's meant to write and work with factory methods and services that can use `entity` annotation metadata to securely and reliably apply hydration, dehyration, and validation on an entity and its relationships as it crosses various data boundaries.

## How It Works

Let's imagine we're modeling a book writing app. We can create a book, each book can have chapters, and each chapter can have pages. We could simply start with:

```ts
class Book {
    title = "untitled book";
    chapters: Chapter[] = [];
}

class Chapter {
    title: "untitled chapter";
    pages: Page[] = [];
}

class Page {
    paragraphs: string[];
}
```

Now, we can start to describe more explicit models and relationships:

```ts
@Model({collection: 'bookwriter', model: 'book'})
class Book {
    @Property({isRequired: true})
    title = "untitled book";
    @Property({isRequired: true, isArray: true, relationship: {
        relType: 'child',
        emid: 'bookwriter.chapter'
    }})
    chapters: Chapter[] = [];
}

@Model({collection: 'bookwriter', model: 'Chapter'})
class Chapter {
    @Property()
    _ids
    @Property({isRequired: true})
    title: "untitled chapter";
    @Property({isRequired: true, isArray: true, relationship: {
        relType: 'child',
        emid: 'bookwriter.page'
    }})
    pages: Page[] = [];
}

@Model({collection: 'bookwriter', model: 'page'})
class Page {
    @Property({isRequired: true, isArray: true})
    paragraphs: string[];
}
```

In the above code, we've:

- defined a **`collection`** that our classes belong to
- 