create table editorial_documents (
    document_key varchar(64) primary key,
    content text not null,
    updated_at timestamp with time zone not null
);
